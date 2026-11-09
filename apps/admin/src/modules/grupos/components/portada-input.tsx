import React, { useEffect, useState } from 'react';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { Spinner } from '../../../components/ui/ios-spinner';
import { subirImagenPublica } from '../../../shared/api/domains/grupos';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

interface PortadaInputProps {
  tipo: 'grupo' | 'album';
  /** URL pública de la imagen actual, si existe. */
  urlActual?: string;
  onSubida: (key: string) => void;
}

/** Elegir y subir una portada. La imagen queda en el servidor; el formulario guarda su clave. */
export const PortadaInput: React.FC<PortadaInputProps> = ({ tipo, urlActual, onSubida }) => {
  const [preview, setPreview] = useState<string | undefined>(urlActual);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => () => {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
  }, [preview]);

  const elegir = async (archivo: File | undefined) => {
    if (!archivo) return;
    if (!TIPOS.includes(archivo.type)) {
      pillToast.error('Formato no admitido', 'Usa JPEG, PNG o WebP.');
      return;
    }
    if (archivo.size > MAX_BYTES) {
      pillToast.error('Imagen muy grande', 'El máximo es 2 MB.');
      return;
    }
    setPreview(URL.createObjectURL(archivo));
    setSubiendo(true);
    try {
      const key = await subirImagenPublica(archivo, tipo);
      onSubida(key);
      pillToast.success('Portada lista', 'Guarda los cambios para aplicarla.');
    } catch (err) {
      pillToast.error('No se pudo subir la portada', err instanceof Error ? err.message : undefined);
      setPreview(urlActual);
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-muted/40">
        {preview ? (
          <img src={preview} alt="Portada" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-muted-foreground">Sin portada</span>
        )}
      </div>
      <div className="space-y-2">
        <label className="inline-flex">
          <input
            type="file"
            accept={TIPOS.join(',')}
            className="sr-only"
            disabled={subiendo}
            onChange={(e) => void elegir(e.target.files?.[0])}
          />
          <span className="inline-flex cursor-pointer items-center rounded-xl border border-border/60 px-3 py-1.5 text-sm font-medium hover:bg-muted/70">
            {subiendo ? <Spinner size="sm" /> : 'Elegir imagen'}
          </span>
        </label>
        <p className="text-xs text-muted-foreground">JPEG, PNG o WebP · máx. 2 MB</p>
      </div>
    </div>
  );
};

export default PortadaInput;
