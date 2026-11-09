import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../shared/components/ui/button';
import { Input } from '../../../shared/components/ui/input';
import { Switch } from '../../../shared/components/ui/switch';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { Spinner } from '../../../components/ui/ios-spinner';
import { gruposApi, type GrupoDetalle } from '../../../shared/api/domains/grupos';

/** Configuración de ventas del grupo. Solo admin: habilita la venta de pistas y fija la comisión. */
export const GrupoConfiguracion: React.FC<{ grupo: GrupoDetalle }> = ({ grupo }) => {
  const queryClient = useQueryClient();
  const [vende, setVende] = useState(grupo.vende_pistas);
  const [comision, setComision] = useState(grupo.comision_pct != null ? String(grupo.comision_pct) : '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    setError(null);
    let comisionNumero: number | undefined;
    if (vende) {
      comisionNumero = Number(comision.replace(',', '.'));
      if (!comision || Number.isNaN(comisionNumero) || comisionNumero < 5 || comisionNumero > 10) {
        setError('Para vender pistas, la comisión debe estar entre 5 y 10 %.');
        return;
      }
    }
    setEnviando(true);
    try {
      await gruposApi.actualizar(grupo.id, { vende_pistas: vende, comision_pct: comisionNumero });
      await queryClient.invalidateQueries({ queryKey: ['grupo', grupo.id] });
      await queryClient.invalidateQueries({ queryKey: ['grupos'] });
      pillToast.success(vende ? 'Venta de pistas habilitada' : 'Venta de pistas desactivada', grupo.nombre);
    } catch (err) {
      pillToast.error('No se pudo guardar la configuración', err instanceof Error ? err.message : undefined);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-border/50 px-4 py-4">
        <div>
          <p className="text-sm font-medium">Habilitar venta de pistas</p>
          <p className="text-xs text-muted-foreground">
            Las canciones con pista de este grupo aparecen en el catálogo de ventas.
          </p>
        </div>
        <Switch checked={vende} onCheckedChange={setVende} />
      </div>

      {vende && (
        <div className="space-y-1.5">
          <label htmlFor="comision" className="text-xs font-medium text-muted-foreground">
            Comisión de la plataforma (5 a 10 %)
          </label>
          <Input
            id="comision"
            inputMode="decimal"
            placeholder="7.5"
            value={comision}
            onChange={(e) => setComision(e.target.value)}
            className="max-w-[10rem]"
          />
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      <div className="flex justify-end">
        <Button onClick={() => void guardar()} disabled={enviando}>
          {enviando ? <Spinner size="sm" /> : 'Guardar configuración'}
        </Button>
      </div>
    </div>
  );
};

export default GrupoConfiguracion;
