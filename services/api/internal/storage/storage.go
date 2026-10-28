// Package storage abstrae el almacenamiento de objetos compatible con S3
// (MinIO en desarrollo). Los masters y comprobantes son privados y se sirven
// con URLs firmadas breves; los previews son públicos vía URL base pública.
package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	awscfg "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"triomision/api/internal/config"
)

type PostUpload struct {
	URL    string
	Fields map[string]string
}

// Client es lo que los módulos de negocio necesitan del almacén de objetos.
// *S3Client la satisface; los tests usan implementaciones falsas.
type Client interface {
	// PresignGet firma una URL de lectura breve para un objeto privado.
	PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error)
	// PresignPost limita clave, MIME y tamaño de una subida privada.
	PresignPost(ctx context.Context, key, contentType string, maxBytes int64, ttl time.Duration) (PostUpload, error)
	// PublicURL devuelve la URL directa de un objeto público (preview).
	PublicURL(key string) string
	// Head verifica que un objeto existe y devuelve su tamaño y tipo.
	Head(ctx context.Context, key string) (size int64, contentType string, err error)
	// PutObject sube un objeto (lo usa el seed de desarrollo).
	PutObject(ctx context.Context, key, contentType string, body io.Reader) error
}

// S3Client implementa Client sobre AWS SDK v2 con endpoint personalizado
// (MinIO) y direccionamiento por path style.
type S3Client struct {
	bucket     string
	publicBase string
	api        *s3.Client
	presigner  *s3.PresignClient
}

// New crea el cliente S3 a partir de la configuración. Devuelve error si
// falta algún campo obligatorio o el servicio no responde.
func New(ctx context.Context, cfg config.S3Config) (*S3Client, error) {
	if cfg.Endpoint == "" || cfg.Bucket == "" || cfg.AccessKey == "" || cfg.SecretKey == "" {
		return nil, errors.New("configuración S3 incompleta: endpoint, bucket, access key y secret key son requeridos")
	}
	awsCfg, err := awscfg.LoadDefaultConfig(ctx,
		awscfg.WithRegion(cfg.Region),
		awscfg.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, "")),
		awscfg.WithBaseEndpoint(cfg.Endpoint),
	)
	if err != nil {
		return nil, fmt.Errorf("configurar cliente S3: %w", err)
	}
	api := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		// MinIO (y otros S3 autoalojados) usan path style: endpoint/bucket/key.
		o.UsePathStyle = true
	})
	return &S3Client{
		bucket:     cfg.Bucket,
		publicBase: cfg.PublicBase,
		api:        api,
		presigner:  s3.NewPresignClient(api),
	}, nil
}

func (c *S3Client) PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error) {
	out, err := c.presigner.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: &c.bucket,
		Key:    &key,
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", fmt.Errorf("firmar URL de lectura: %w", err)
	}
	return out.URL, nil
}

func (c *S3Client) PresignPost(ctx context.Context, key, contentType string, maxBytes int64, ttl time.Duration) (PostUpload, error) {
	out, err := c.presigner.PresignPostObject(ctx, &s3.PutObjectInput{
		Bucket:      &c.bucket,
		Key:         &key,
		ContentType: &contentType,
	}, func(o *s3.PresignPostOptions) {
		o.Expires = ttl
		o.Conditions = append(o.Conditions,
			map[string]string{"Content-Type": contentType},
			[]any{"content-length-range", 1, maxBytes})
	})
	if err != nil {
		return PostUpload{}, fmt.Errorf("firmar formulario de subida: %w", err)
	}
	out.Values["Content-Type"] = contentType
	return PostUpload{URL: out.URL, Fields: out.Values}, nil
}

func (c *S3Client) PublicURL(key string) string {
	return fmt.Sprintf("%s/%s", c.publicBase, key)
}

func (c *S3Client) Head(ctx context.Context, key string) (int64, string, error) {
	out, err := c.api.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: &c.bucket,
		Key:    &key,
	})
	if err != nil {
		return 0, "", fmt.Errorf("verificar objeto %s: %w", key, err)
	}
	size := int64(0)
	if out.ContentLength != nil {
		size = *out.ContentLength
	}
	contentType := ""
	if out.ContentType != nil {
		contentType = *out.ContentType
	}
	return size, contentType, nil
}

func (c *S3Client) PutObject(ctx context.Context, key, contentType string, body io.Reader) error {
	_, err := c.api.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      &c.bucket,
		Key:         &key,
		ContentType: &contentType,
		Body:        body,
	})
	if err != nil {
		return fmt.Errorf("subir objeto %s: %w", key, err)
	}
	return nil
}
