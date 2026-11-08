'use client';

import * as React from 'react';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronDown,
  Copy,
  CheckCheck,
  Filter,
  Search,
  X,
  Code2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type LogLevel = 'info' | 'warning' | 'error';

export interface Log {
  id: string;
  timestamp: string;
  timeDisplay?: string;
  level: LogLevel;
  service: string;
  message: string;
  duration: string;
  status: string;
  tags: string[];
  traceId?: string;
  clientIp?: string;
  payload?: Record<string, unknown>;
}

export type Filters = {
  level: string[];
  service: string[];
  status: string[];
};

export const SAMPLE_LOGS: Log[] = [
  {
    id: '1',
    timestamp: '2024-11-08T18:32:45Z',
    timeDisplay: '06:32:45 PM',
    level: 'info',
    service: 'api-gateway',
    message: 'Request processed successfully',
    duration: '245ms',
    status: '200',
    tags: ['api', 'success'],
    traceId: 'tr_api_9a8f2c3d4e5f',
    clientIp: '192.168.1.104',
    payload: {
      endpoint: '/api/v1/checkout/session',
      method: 'POST',
      statusCode: 200,
      responseTimeMs: 245,
    },
  },
  {
    id: '2',
    timestamp: '2024-11-08T18:32:42Z',
    timeDisplay: '06:32:42 PM',
    level: 'warning',
    service: 'cache-service',
    message: 'Cache miss ratio exceeds threshold',
    duration: '1.2s',
    status: 'warning',
    tags: ['cache', 'performance'],
    traceId: 'tr_csh_8b7e1a2f3c4d',
    clientIp: '10.0.4.12',
    payload: {
      cacheCluster: 'redis-primary-eu-west',
      missRate: '42.8%',
      threshold: '25.0%',
      latencyMs: 1200,
    },
  },
  {
    id: '3',
    timestamp: '2024-11-08T18:32:40Z',
    timeDisplay: '06:32:40 PM',
    level: 'error',
    service: 'database',
    message: 'Connection timeout to replica',
    duration: '5.1s',
    status: '503',
    tags: ['db', 'error'],
    traceId: 'tr_pg_7c6d0e1b2a3f',
    clientIp: '10.0.8.45',
    payload: {
      cluster: 'postgres-read-replica-02',
      timeoutSeconds: 5.0,
      retryCount: 3,
      error: 'ETIMEDOUT',
    },
  },
  {
    id: '4',
    timestamp: '2024-11-08T18:32:38Z',
    timeDisplay: '06:32:38 PM',
    level: 'info',
    service: 'auth-service',
    message: 'User session created',
    duration: '156ms',
    status: '201',
    tags: ['auth', 'session'],
    traceId: 'tr_ath_6d5c9b0a1f2e',
    clientIp: '172.56.21.89',
    payload: {
      userId: 'usr_apple_pro_8891',
      authMethod: 'oauth2_apple_id',
      sessionExpiry: '7d',
    },
  },
  {
    id: '5',
    timestamp: '2024-11-08T18:32:35Z',
    timeDisplay: '06:32:35 PM',
    level: 'info',
    service: 'api-gateway',
    message: 'Webhook delivered',
    duration: '432ms',
    status: '200',
    tags: ['webhook', 'integration'],
    traceId: 'tr_whk_5e4b8a9f0e1d',
    clientIp: '54.210.12.8',
    payload: {
      webhookEvent: 'invoice.payment_succeeded',
      recipientHost: 'hooks.stripe.com',
      attempt: 1,
    },
  },
  {
    id: '6',
    timestamp: '2024-11-08T18:32:32Z',
    timeDisplay: '06:32:32 PM',
    level: 'error',
    service: 'payment-service',
    message: 'Payment gateway unavailable',
    duration: '2.3s',
    status: '502',
    tags: ['payment', 'error'],
    traceId: 'tr_pay_4f3a7e8d9c0b',
    clientIp: '34.201.88.19',
    payload: {
      gateway: 'adyen-global-v3',
      upstreamResponse: '502 Bad Gateway',
      transactionId: 'tx_99812401',
    },
  },
  {
    id: '7',
    timestamp: '2024-11-08T18:32:30Z',
    timeDisplay: '06:32:30 PM',
    level: 'info',
    service: 'search-service',
    message: 'Index updated',
    duration: '876ms',
    status: '200',
    tags: ['search', 'index'],
    traceId: 'tr_srch_3a2f6e7c8b9a',
    clientIp: '10.0.12.90',
    payload: {
      engine: 'meilisearch-v1',
      documentsIndexed: 1420,
      indexName: 'products_catalog_v2',
    },
  },
  {
    id: '8',
    timestamp: '2024-11-08T18:32:28Z',
    timeDisplay: '06:32:28 PM',
    level: 'warning',
    service: 'api-gateway',
    message: 'Rate limit approaching',
    duration: '145ms',
    status: '429',
    tags: ['rate-limit', 'warning'],
    traceId: 'tr_lim_2b1e5d6a7f8e',
    clientIp: '198.51.100.24',
    payload: {
      currentBucketUsage: 98,
      capacity: 100,
      retryAfterSeconds: 60,
    },
  },
];

const levelStyles: Record<LogLevel, string> = {
  info: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  error: 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20',
};

const statusStyles: Record<string, string> = {
  '200': 'text-emerald-600 dark:text-emerald-400',
  '201': 'text-emerald-600 dark:text-emerald-400',
  '429': 'text-amber-600 dark:text-amber-400',
  '502': 'text-red-600 dark:text-red-400',
  '503': 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
};

function LogRow({
  log,
  expanded,
  onToggle,
}: {
  log: Log;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const formattedTime =
    log.timeDisplay ||
    new Date(log.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

  const handleCopyJson = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border-b border-border/40 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 text-left transition-colors hover:bg-neutral-500/5 active:bg-neutral-500/10 focus-visible:outline-none focus-visible:bg-neutral-500/5"
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0"
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground/70" />
          </motion.div>

          <Badge
            variant="secondary"
            className={cn('shrink-0 px-2 py-0.5 text-[11px] font-semibold capitalize', levelStyles[log.level])}
          >
            {log.level === 'info' ? 'Info' : log.level === 'warning' ? 'Warning' : 'Error'}
          </Badge>

          <time className="w-20 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
            {formattedTime}
          </time>

          <span className="shrink-0 min-w-max text-sm font-semibold text-foreground tracking-tight">
            {log.service}
          </span>

          <p className="flex-1 min-w-0 truncate text-sm text-foreground/80">
            {log.message}
          </p>

          <span
            className={cn(
              'shrink-0 font-mono text-sm font-semibold tabular-nums',
              statusStyles[log.status] ?? 'text-muted-foreground'
            )}
          >
            {log.status}
          </span>

          <span className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
            {log.duration}
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-border/50 bg-neutral-500/5 backdrop-blur-sm"
          >
            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Mensaje
                  </p>
                  <p className="rounded-lg border border-border/40 bg-background/80 p-3 font-mono text-xs sm:text-sm text-foreground shadow-xs">
                    {log.message}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyJson}
                  className="gap-1.5 text-xs rounded-lg shrink-0 mt-6"
                >
                  {copied ? (
                    <>
                      <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                      <span>JSON Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copiar JSON</span>
                    </>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="rounded-lg border border-border/40 bg-background/60 p-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                    Latencia
                  </p>
                  <p className="font-mono text-foreground tabular-nums font-semibold">
                    {log.duration}
                  </p>
                </div>
                <div className="rounded-lg border border-border/40 bg-background/60 p-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                    Marca de Tiempo
                  </p>
                  <p className="font-mono text-foreground tabular-nums truncate">
                    {log.timestamp}
                  </p>
                </div>
                <div className="rounded-lg border border-border/40 bg-background/60 p-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                    ID de Traza
                  </p>
                  <p className="font-mono text-foreground tabular-nums truncate">
                    {log.traceId || `tr_${log.id}_00x`}
                  </p>
                </div>
                <div className="rounded-lg border border-border/40 bg-background/60 p-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                    IP Cliente
                  </p>
                  <p className="font-mono text-foreground tabular-nums">
                    {log.clientIp || '127.0.0.1'}
                  </p>
                </div>
              </div>

              {log.payload && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <Code2 className="h-3.5 w-3.5" />
                    <span>Payload & Diagnóstico</span>
                  </div>
                  <pre className="overflow-x-auto rounded-lg border border-border/40 bg-background/80 p-3 font-mono text-[11px] text-foreground/90">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                  Etiquetas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {log.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-[11px] font-mono px-2 py-0.5 rounded-md border-border/60"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterPanel({
  filters,
  onChange,
  logs,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
  logs: Log[];
}) {
  const levels = useMemo(
    () => Array.from(new Set(logs.map((log) => log.level))),
    [logs]
  );
  const services = useMemo(
    () => Array.from(new Set(logs.map((log) => log.service))),
    [logs]
  );
  const statuses = useMemo(
    () => Array.from(new Set(logs.map((log) => log.status))),
    [logs]
  );

  const toggleFilter = (category: keyof Filters, value: string) => {
    const current = filters[category];
    const updated = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];

    onChange({
      ...filters,
      [category]: updated,
    });
  };

  const clearAll = () => {
    onChange({
      level: [],
      service: [],
      status: [],
    });
  };

  const hasActiveFilters = Object.values(filters).some(
    (group) => group.length > 0
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ delay: 0.05 }}
      className="flex h-full flex-col space-y-6 overflow-y-auto bg-card/60 backdrop-blur-md p-4 text-left"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground tracking-tight">Filtros</h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      <div className="space-y-2.5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Nivel de Severidad
        </p>
        <div className="space-y-1.5">
          {levels.map((level) => {
            const selected = filters.level.includes(level);

            return (
              <motion.button
                key={level}
                type="button"
                whileHover={{ x: 2 }}
                onClick={() => toggleFilter('level', level)}
                aria-pressed={selected}
                className={cn(
                  'flex w-full items-center justify-between gap-2 border rounded-lg px-3 py-1.5 text-xs transition-colors',
                  selected
                    ? 'border-primary/60 bg-primary/10 text-primary font-medium'
                    : 'border-border/60 text-muted-foreground hover:border-primary/40 hover:bg-muted/40'
                )}
              >
                <span className="capitalize">{level}</span>
                {selected && <Check className="h-3.5 w-3.5" />}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2.5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Microservicio
        </p>
        <div className="space-y-1.5">
          {services.map((service) => {
            const selected = filters.service.includes(service);

            return (
              <motion.button
                key={service}
                type="button"
                whileHover={{ x: 2 }}
                onClick={() => toggleFilter('service', service)}
                aria-pressed={selected}
                className={cn(
                  'flex w-full items-center justify-between gap-2 border rounded-lg px-3 py-1.5 text-xs transition-colors',
                  selected
                    ? 'border-primary/60 bg-primary/10 text-primary font-medium'
                    : 'border-border/60 text-muted-foreground hover:border-primary/40 hover:bg-muted/40'
                )}
              >
                <span>{service}</span>
                {selected && <Check className="h-3.5 w-3.5" />}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2.5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Código de Estado HTTP
        </p>
        <div className="space-y-1.5">
          {statuses.map((status) => {
            const selected = filters.status.includes(status);

            return (
              <motion.button
                key={status}
                type="button"
                whileHover={{ x: 2 }}
                onClick={() => toggleFilter('status', status)}
                aria-pressed={selected}
                className={cn(
                  'flex w-full items-center justify-between gap-2 border rounded-lg px-3 py-1.5 text-xs font-mono tabular-nums transition-colors',
                  selected
                    ? 'border-primary/60 bg-primary/10 text-primary font-medium'
                    : 'border-border/60 text-muted-foreground hover:border-primary/40 hover:bg-muted/40'
                )}
              >
                <span>{status}</span>
                {selected && <Check className="h-3.5 w-3.5" />}
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

export interface InteractiveLogsTableProps {
  logs?: Log[];
  className?: string;
  title?: string;
  hideHeader?: boolean;
}

export function InteractiveLogsTable({
  logs = SAMPLE_LOGS,
  className,
  title = 'Logs',
  hideHeader = false,
}: InteractiveLogsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    level: [],
    service: [],
    status: [],
  });

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        q === '' ||
        log.message.toLowerCase().includes(q) ||
        log.service.toLowerCase().includes(q) ||
        log.status.toLowerCase().includes(q) ||
        log.tags.some((tag) => tag.toLowerCase().includes(q));

      const matchLevel =
        filters.level.length === 0 || filters.level.includes(log.level);

      const matchService =
        filters.service.length === 0 || filters.service.includes(log.service);

      const matchStatus =
        filters.status.length === 0 || filters.status.includes(log.status);

      return matchSearch && matchLevel && matchService && matchStatus;
    });
  }, [filters, logs, searchQuery]);

  const activeFilters =
    filters.level.length + filters.service.length + filters.status.length;

  return (
    <div
      className={cn(
        'w-full rounded-2xl border border-border/50 bg-card text-card-foreground shadow-xs overflow-hidden flex flex-col',
        className
      )}
    >
      {!hideHeader && (
        <div className="border-b border-border/50 bg-background/50 backdrop-blur-md p-4 sm:p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  {title}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 tabular-nums">
                  {filteredLogs.length} de {logs.length} registros
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar logs por mensaje o servicio..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-9.5 pl-9.5 pr-8 text-sm rounded-xl bg-background border-border/70 focus-visible:ring-1"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Button
                variant={showFilters ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFilters((current) => !current)}
                className={cn(
                  'relative h-9.5 px-3 rounded-xl gap-2 text-xs font-medium transition-all',
                  showFilters && 'shadow-sm'
                )}
              >
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">Filtros</span>
                {activeFilters > 0 && (
                  <Badge className="flex h-4.5 w-4.5 items-center justify-center p-0 text-[10px] tabular-nums bg-primary text-primary-foreground">
                    {activeFilters}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden min-h-[380px]">
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              key="filters"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden border-r border-border/50 shrink-0"
            >
              <FilterPanel
                filters={filters}
                onChange={setFilters}
                logs={logs}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {filteredLogs.length > 0 ? (
              <div className="divide-y divide-border/40">
                {filteredLogs.map((log, index) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{
                      duration: 0.18,
                      delay: Math.min(index * 0.02, 0.15),
                    }}
                  >
                    <LogRow
                      log={log}
                      expanded={expandedId === log.id}
                      onToggle={() =>
                        setExpandedId((current) =>
                          current === log.id ? null : log.id
                        )
                      }
                    />
                  </motion.div>
                ))}
              </div>
            ) : (
              <motion.div
                key="empty-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-16 text-center space-y-2"
              >
                <p className="text-sm font-medium text-foreground">
                  No se encontraron registros
                </p>
                <p className="text-xs text-muted-foreground">
                  No hay eventos que coincidan con la búsqueda o filtros actuales.
                </p>
                {(searchQuery || activeFilters > 0) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setFilters({ level: [], service: [], status: [] });
                    }}
                    className="mt-2 text-xs rounded-xl"
                  >
                    Restablecer búsqueda y filtros
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default InteractiveLogsTable;
