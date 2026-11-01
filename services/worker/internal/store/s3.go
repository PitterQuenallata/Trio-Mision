// Package store es el cliente mínimo de MinIO del worker: solo descarga el
// PDF de entrada (la subida y las URLs firmadas son responsabilidad de la API).
package store

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"

	awscfg "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"triomision/worker/internal/config"
)

// S3Store descarga objetos del bucket privado.
type S3Store struct {
	bucket string
	api    *s3.Client
}

// New crea el cliente con endpoint personalizado (path style, como la API).
func New(ctx context.Context, cfg config.S3Config) (*S3Store, error) {
	awsCfg, err := awscfg.LoadDefaultConfig(ctx,
		awscfg.WithRegion(cfg.Region),
		awscfg.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, "")),
		awscfg.WithBaseEndpoint(cfg.Endpoint),
	)
	if err != nil {
		return nil, fmt.Errorf("configurar cliente S3: %w", err)
	}
	api := s3.NewFromConfig(awsCfg, func(o *s3.Options) { o.UsePathStyle = true })
	return &S3Store{bucket: cfg.Bucket, api: api}, nil
}

// DownloadToFile descarga key a destPath (streaming a disco: los PDF pueden
// superar la memoria razonable de un proceso pequeño).
func (s *S3Store) DownloadToFile(ctx context.Context, key, destPath string) (err error) {
	out, err := s.api.GetObject(ctx, &s3.GetObjectInput{Bucket: &s.bucket, Key: &key})
	if err != nil {
		return fmt.Errorf("descargar %s: %w", key, err)
	}
	defer out.Body.Close()

	f, err := os.Create(destPath)
	if err != nil {
		return fmt.Errorf("crear archivo temporal: %w", err)
	}
	defer func() {
		f.Close()
		if err != nil {
			os.Remove(destPath)
		}
	}()
	if _, err := io.Copy(f, out.Body); err != nil {
		return fmt.Errorf("guardar %s: %w", key, err)
	}
	return nil
}

// ErrNotFound señala un objeto inexistente (el job queda failed).
var ErrNotFound = errors.New("objeto no encontrado en el almacén")
