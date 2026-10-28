package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"log"
	"math"
	"os"

	"github.com/jackc/pgx/v5"

	"triomision/api/internal/config"
	"triomision/api/internal/storage"
)

// UUIDs fijos para que el demo de tienda sea reproducible entre entornos y
// referenciable desde la colección Bruno tras un reset.
const (
	albumDemoID   = "00000000-0000-4000-8000-000000000201"
	songDemoID    = "00000000-0000-4000-8000-000000000202"
	trackDemoID   = "00000000-0000-4000-8000-000000000203"
	productoID    = "00000000-0000-4000-8000-000000000204"
	ofertaDemoID  = "00000000-0000-4000-8000-000000000205"
	masterDemoID  = "00000000-0000-4000-8000-000000000206"
	previewDemoID = "00000000-0000-4000-8000-000000000207"
	songPremiumID = "00000000-0000-4000-8000-000000000208"
	// Sprint 3C.1: segunda pista y paquete de dos pistas (snapshot congelado).
	songDemo2ID     = "00000000-0000-4000-8000-000000000212"
	trackDemo2ID    = "00000000-0000-4000-8000-000000000213"
	masterDemo2ID   = "00000000-0000-4000-8000-000000000214"
	previewDemo2ID  = "00000000-0000-4000-8000-000000000215"
	ofertaPaqDemoID = "00000000-0000-4000-8000-000000000217"
)

// seedStore carga el demo de la tienda Sprint 3A: una pista publicada con
// master (privado) y preview (público) subidos a S3, su producto y una oferta
// en BOB. Sin S3 configurado omite el demo con un aviso (catálogo e himnario
// se siembran igual).
func seedStore(ctx context.Context, tx pgx.Tx) error {
	if os.Getenv("S3_ENDPOINT") == "" {
		log.Println("tienda: S3_ENDPOINT vacío, se omite el demo de tienda (subidas/descargas no disponibles)")
		return nil
	}

	s3cfg := config.S3Config{
		Endpoint:   os.Getenv("S3_ENDPOINT"),
		Region:     os.Getenv("S3_REGION"),
		Bucket:     os.Getenv("S3_BUCKET"),
		AccessKey:  os.Getenv("S3_ACCESS_KEY"),
		SecretKey:  os.Getenv("S3_SECRET_KEY"),
		PublicBase: os.Getenv("S3_PUBLIC_BASE_URL"),
	}
	objects, err := storage.New(ctx, s3cfg)
	if err != nil {
		return fmt.Errorf("cliente S3: %w", err)
	}

	masterKey := fmt.Sprintf("tracks/%s/master.wav", trackDemoID)
	previewKey := fmt.Sprintf("public/tracks/%s/preview.wav", trackDemoID)

	master := wavSine(5, 440.0)
	preview := wavSine(2, 330.0)
	for _, obj := range []struct {
		key, mime string
		data      []byte
	}{
		{masterKey, "audio/wav", master},
		{previewKey, "audio/wav", preview},
	} {
		if err := objects.PutObject(ctx, obj.key, obj.mime, bytes.NewReader(obj.data)); err != nil {
			return fmt.Errorf("subir %s: %w", obj.key, err)
		}
	}
	masterSum := fmt.Sprintf("%x", sha256.Sum256(master))
	previewSum := fmt.Sprintf("%x", sha256.Sum256(preview))
	log.Printf("tienda: %s y %s subidos a %s", masterKey, previewKey, s3cfg.Bucket)

	// Álbum y canción demo del catálogo existente (artista trio-mision fijo).
	if _, err := tx.Exec(ctx, `
		insert into albums (id, artist_id, title, year, sort_order, is_published)
		values ($1, '00000000-0000-4000-8000-000000000001', 'Celebremos Su Gloria (demo)', 2024, 100, true)
		on conflict (id) do update set title = excluded.title, is_published = true, deleted_at = null`,
		albumDemoID); err != nil {
		return fmt.Errorf("álbum demo: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		insert into songs (id, album_id, title, chordpro, original_key, sort_order, is_published)
		values ($1, $2, 'Cuan grande es Él',
			'{title: Cuan grande es Él}' || chr(10) || '{key: G}' || chr(10) || chr(10) ||
			'G' || chr(10) || 'Mi alma canta al contemplar' || chr(10) || 'D7' || chr(10) ||
			'la obra de su amor sin par;',
			'G', 1, true)
		on conflict (id) do update set title = excluded.title, is_published = true, deleted_at = null`,
		songDemoID, albumDemoID); err != nil {
		return fmt.Errorf("canción demo: %w", err)
	}

	// Canción de acceso premium: el catálogo público no entrega su ChordPro
	// (403), pero member/manager del artista sí la leen (Sprint 3B).
	if _, err := tx.Exec(ctx, `
		insert into songs (id, album_id, title, chordpro, original_key, sort_order,
		                   publication_access, is_published)
		values ($1, $2, 'Estrella de la mañana (premium demo)',
			'{title: Estrella de la mañana}' || chr(10) || '{key: D}' || chr(10) || chr(10) ||
			'D' || chr(10) || 'Brilla cual estrella de la mañana;',
			'D', 2, 'premium', true)
		on conflict (id) do update set title = excluded.title,
			publication_access = excluded.publication_access, is_published = true, deleted_at = null`,
		songPremiumID, albumDemoID); err != nil {
		return fmt.Errorf("canción premium demo: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into tracks (id, artist_id, song_id, title, description, is_published)
		values ($1, '00000000-0000-4000-8000-000000000001', $2,
			'Cuan grande es Él (pista)', 'Pista de demostración del flujo de compra (Sprint 3A).', true)
		on conflict (id) do update set title = excluded.title, is_published = true, deleted_at = null`,
		trackDemoID, songDemoID); err != nil {
		return fmt.Errorf("pista demo: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into media_assets (id, storage_key, media_type, mime_type, byte_size, checksum_sha256,
			duration_ms, codec, sample_rate, channels, visibility, processing_status)
		values ($1, $2, 'audio', 'audio/wav', $3, $4, $5, 'pcm_s16le', 22050, 1, $6, 'ready')
		on conflict (id) do update set storage_key = excluded.storage_key, byte_size = excluded.byte_size,
			checksum_sha256 = excluded.checksum_sha256, deleted_at = null`,
		masterDemoID, masterKey, len(master), masterSum, 5000, "private"); err != nil {
		return fmt.Errorf("asset master: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		insert into media_assets (id, storage_key, media_type, mime_type, byte_size, checksum_sha256,
			duration_ms, codec, sample_rate, channels, visibility, processing_status)
		values ($1, $2, 'audio', 'audio/wav', $3, $4, $5, 'pcm_s16le', 22050, 1, $6, 'ready')
		on conflict (id) do update set storage_key = excluded.storage_key, byte_size = excluded.byte_size,
			checksum_sha256 = excluded.checksum_sha256, deleted_at = null`,
		previewDemoID, previewKey, len(preview), previewSum, 2000, "public"); err != nil {
		return fmt.Errorf("asset preview: %w", err)
	}

	for _, rel := range []struct {
		assetID, role string
	}{
		{masterDemoID, "master"},
		{previewDemoID, "preview"},
	} {
		if _, err := tx.Exec(ctx, `
			insert into track_media (track_id, media_asset_id, role, is_published)
			values ($1, $2, $3, true)
			on conflict do nothing`, trackDemoID, rel.assetID, rel.role); err != nil {
			return fmt.Errorf("relación %s: %w", rel.role, err)
		}
	}

	if _, err := tx.Exec(ctx, `
		insert into products (id, artist_id, product_type, title, description, active)
		values ($1, '00000000-0000-4000-8000-000000000001', 'track',
			'Pista: Cuan grande es Él', 'Descarga del master WAV de la pista demo.', true)
		on conflict (id) do update set title = excluded.title, active = true`,
		productoID); err != nil {
		return fmt.Errorf("producto demo: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		insert into product_items (product_id, track_id, sort_order)
		values ($1, $2, 1)
		on conflict do nothing`, productoID, trackDemoID); err != nil {
		return fmt.Errorf("ítem de producto: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		insert into offers (id, product_id, amount_minor, currency, sales_channel, active)
		values ($1, $2, 1500, 'BOB', 'web', true)
		on conflict (id) do update set amount_minor = excluded.amount_minor, active = true`,
		ofertaDemoID, productoID); err != nil {
		return fmt.Errorf("oferta demo: %w", err)
	}

	// ── Sprint 3C.1: segunda pista y paquete de dos pistas ──────────────
	master2Key := fmt.Sprintf("tracks/%s/master.wav", trackDemo2ID)
	preview2Key := fmt.Sprintf("public/tracks/%s/preview.wav", trackDemo2ID)
	master2 := wavSine(5, 523.25)
	preview2 := wavSine(2, 392.0)
	for _, obj := range []struct {
		key, mime string
		data      []byte
	}{
		{master2Key, "audio/wav", master2},
		{preview2Key, "audio/wav", preview2},
	} {
		if err := objects.PutObject(ctx, obj.key, obj.mime, bytes.NewReader(obj.data)); err != nil {
			return fmt.Errorf("subir %s: %w", obj.key, err)
		}
	}
	master2Sum := fmt.Sprintf("%x", sha256.Sum256(master2))
	preview2Sum := fmt.Sprintf("%x", sha256.Sum256(preview2))
	log.Printf("tienda: %s y %s subidos a %s", master2Key, preview2Key, s3cfg.Bucket)

	if _, err := tx.Exec(ctx, `
		insert into songs (id, album_id, title, chordpro, original_key, sort_order, is_published)
		values ($1, $2, 'Al mundo paz (demo)',
			'{title: Al mundo paz}' || chr(10) || '{key: C}' || chr(10) || chr(10) ||
			'C' || chr(10) || 'Al mundo paz, ¡sublime don!',
			'C', 3, true)
		on conflict (id) do update set title = excluded.title, is_published = true, deleted_at = null`,
		songDemo2ID, albumDemoID); err != nil {
		return fmt.Errorf("canción demo 2: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		insert into tracks (id, artist_id, song_id, title, description, is_published)
		values ($1, '00000000-0000-4000-8000-000000000001', $2,
			'Al mundo paz (pista)', 'Segunda pista del paquete demo (Sprint 3C.1).', true)
		on conflict (id) do update set title = excluded.title, is_published = true, deleted_at = null`,
		trackDemo2ID, songDemo2ID); err != nil {
		return fmt.Errorf("pista demo 2: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		insert into media_assets (id, storage_key, media_type, mime_type, byte_size, checksum_sha256,
			duration_ms, codec, sample_rate, channels, visibility, processing_status)
		values ($1, $2, 'audio', 'audio/wav', $3, $4, $5, 'pcm_s16le', 22050, 1, $6, 'ready')
		on conflict (id) do update set storage_key = excluded.storage_key, byte_size = excluded.byte_size,
			checksum_sha256 = excluded.checksum_sha256, deleted_at = null`,
		masterDemo2ID, master2Key, len(master2), master2Sum, 5000, "private"); err != nil {
		return fmt.Errorf("asset master 2: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		insert into media_assets (id, storage_key, media_type, mime_type, byte_size, checksum_sha256,
			duration_ms, codec, sample_rate, channels, visibility, processing_status)
		values ($1, $2, 'audio', 'audio/wav', $3, $4, $5, 'pcm_s16le', 22050, 1, $6, 'ready')
		on conflict (id) do update set storage_key = excluded.storage_key, byte_size = excluded.byte_size,
			checksum_sha256 = excluded.checksum_sha256, deleted_at = null`,
		previewDemo2ID, preview2Key, len(preview2), preview2Sum, 2000, "public"); err != nil {
		return fmt.Errorf("asset preview 2: %w", err)
	}
	for _, rel := range []struct {
		assetID, role string
	}{
		{masterDemo2ID, "master"},
		{previewDemo2ID, "preview"},
	} {
		if _, err := tx.Exec(ctx, `
			insert into track_media (track_id, media_asset_id, role, is_published)
			values ($1, $2, $3, true)
			on conflict do nothing`, trackDemo2ID, rel.assetID, rel.role); err != nil {
			return fmt.Errorf("relación %s: %w", rel.role, err)
		}
	}

	// Paquete de dos pistas con snapshot congelado: una pista añadida al
	// producto después de crear la orden NO se entrega (include_future_tracks=false).
	if _, err := tx.Exec(ctx, `
		insert into products (id, artist_id, product_type, title, description, active, include_future_tracks)
		values ($1, '00000000-0000-4000-8000-000000000001', 'album',
			'Paquete demo: 2 pistas', 'Cuan grande es Él + Al mundo paz (masters WAV).', true, false)
		on conflict (id) do update set title = excluded.title, active = true,
			include_future_tracks = excluded.include_future_tracks`,
		productoPaqID); err != nil {
		return fmt.Errorf("producto paquete: %w", err)
	}
	for _, item := range []struct {
		trackID string
		orden   int
	}{
		{trackDemoID, 1},
		{trackDemo2ID, 2},
	} {
		if _, err := tx.Exec(ctx, `
			insert into product_items (product_id, track_id, sort_order)
			values ($1, $2, $3)
			on conflict do nothing`, productoPaqID, item.trackID, item.orden); err != nil {
			return fmt.Errorf("ítem de paquete: %w", err)
		}
	}
	if _, err := tx.Exec(ctx, `
		insert into offers (id, product_id, amount_minor, currency, sales_channel, active)
		values ($1, $2, 2500, 'BOB', 'web', true)
		on conflict (id) do update set amount_minor = excluded.amount_minor, active = true`,
		ofertaPaqDemoID, productoPaqID); err != nil {
		return fmt.Errorf("oferta paquete: %w", err)
	}

	log.Printf("tienda: pista demo %s, oferta %s (1500 BOB); paquete 2 pistas %s, oferta %s (2500 BOB)",
		trackDemoID, ofertaDemoID, productoPaqID, ofertaPaqDemoID)
	return nil
}

// wavSine genera un WAV PCM 16-bit mono de 22050 Hz con una senoidal: bytes
// reales y reproducibles para verificar subida y descarga contra S3.
func wavSine(seconds int, freq float64) []byte {
	const rate = 22050
	n := rate * seconds
	data := make([]byte, 44+n*2)
	copy(data[0:4], "RIFF")
	binary.LittleEndian.PutUint32(data[4:8], uint32(36+n*2))
	copy(data[8:12], "WAVE")
	copy(data[12:16], "fmt ")
	binary.LittleEndian.PutUint32(data[16:20], 16)
	binary.LittleEndian.PutUint16(data[20:22], 1)
	binary.LittleEndian.PutUint16(data[22:24], 1)
	binary.LittleEndian.PutUint32(data[24:28], rate)
	binary.LittleEndian.PutUint32(data[28:32], rate*2)
	binary.LittleEndian.PutUint16(data[32:34], 2)
	binary.LittleEndian.PutUint16(data[34:36], 16)
	copy(data[36:40], "data")
	binary.LittleEndian.PutUint32(data[40:44], uint32(n*2))
	for i := 0; i < n; i++ {
		sample := math.Sin(2*math.Pi*freq*float64(i)/rate) * 0.3
		binary.LittleEndian.PutUint16(data[44+i*2:], uint16(int16(sample*32767)))
	}
	return data
}
