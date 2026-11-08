import React, { useState } from 'react';
import {
  Heart,
  MessageSquare,
  Share2,
  Send,
  Image as ImageIcon,
  UserPlus,
  UserCheck,
  Search,
  ExternalLink,
  MapPin,
  Building,
  Mail,
  Phone,
  Calendar,
  X,
  Maximize2,
  ShieldCheck,
  KeyRound,
  Activity,
  CheckCircle2,
  Clock,
  Laptop,
  Globe,
  Copy,
  Lock,
  Server,
  Layers,
  FolderKanban,
  Terminal,
  Check,
  Shield,
  Fingerprint,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../shared/components/ui/card';
import { Button } from '../../../shared/components/ui/button';
import { Badge } from '../../../shared/components/ui/badge';
import { Input } from '../../../shared/components/ui/input';
import {
  ProfilePost,
  FollowerUser,
  FriendConnection,
  GalleryMedia,
  Usuario,
} from '../types/usuarios.types';
import {
  currentProfileUser,
  initialPosts,
  initialFollowers,
  initialFriends,
  initialGallery,
} from '../data/usuarios-data';
import { useSound } from '../../../shared/context/sound-context';
import { pillToast } from '../../../shared/components/ui/pill-toast';
import { cn } from '../../../shared/lib/utils';

export type ProfileSubTab = 'technical' | 'feed' | 'followers' | 'friends' | 'gallery';

interface UsuariosProfileTabProps {
  selectedUser?: Usuario | null;
  onNavigateToAccount: () => void;
}

export const UsuariosProfileTab: React.FC<UsuariosProfileTabProps> = ({
  selectedUser,
  onNavigateToAccount,
}) => {
  const { play } = useSound();
  const [activeSubTab, setActiveSubTab] = useState<ProfileSubTab>('technical');
  const [copiedId, setCopiedId] = useState(false);

  // Posts state
  const [posts, setPosts] = useState<ProfilePost[]>(initialPosts);
  const [newPostContent, setNewPostContent] = useState('');
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // Followers & Friends state
  const [followers, setFollowers] = useState<FollowerUser[]>(initialFollowers);
  const [friends] = useState<FriendConnection[]>(initialFriends);
  const [followerSearch, setFollowerSearch] = useState('');
  const [friendSearch, setFriendSearch] = useState('');

  // Gallery state
  const [galleryCategory, setGalleryCategory] = useState<string>('all');
  const [selectedGalleryItem, setSelectedGalleryItem] = useState<GalleryMedia | null>(null);

  // Profile data (defaults to Mathew Anderson or active user)
  const profile = {
    name: selectedUser ? selectedUser.name : currentProfileUser.name,
    handle: selectedUser ? `@${selectedUser.name.toLowerCase().replace(/\s+/g, '_')}` : currentProfileUser.handle,
    role: selectedUser ? selectedUser.role : currentProfileUser.role,
    avatar: selectedUser?.avatar || currentProfileUser.avatar,
    cover: currentProfileUser.cover,
    bio: selectedUser?.bio || currentProfileUser.bio,
    email: selectedUser?.email || currentProfileUser.email,
    phone: selectedUser?.phone || currentProfileUser.phone,
    department: selectedUser?.department || 'Diseño de Producto & UX',
    location: selectedUser?.location || currentProfileUser.location,
    stats: currentProfileUser.stats,
    socials: currentProfileUser.socials,
  };

  // Post creation
  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim()) {
      play('alert');
      pillToast.error('Texto Requerido', 'Escribe una actualización para publicar en el feed.');
      return;
    }

    const newPost: ProfilePost = {
      id: `post-${Date.now()}`,
      authorName: profile.name,
      authorRole: profile.role,
      authorAvatar: profile.avatar,
      timeAgo: 'Hace un momento',
      content: newPostContent,
      likesCount: 0,
      isLiked: false,
      comments: [],
    };

    setPosts([newPost, ...posts]);
    setNewPostContent('');
    play('success');
    pillToast.success('Publicación Compartida', 'Tu actualización ya es visible para el equipo.');
  };

  // Toggle Like
  const handleToggleLike = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const nextLiked = !p.isLiked;
          play(nextLiked ? 'pop' : 'click');
          return {
            ...p,
            isLiked: nextLiked,
            likesCount: nextLiked ? p.likesCount + 1 : p.likesCount - 1,
          };
        }
        return p;
      })
    );
  };

  // Add Comment
  const handleAddComment = (postId: string) => {
    const text = commentInputs[postId];
    if (!text || !text.trim()) return;

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          return {
            ...p,
            comments: [
              ...p.comments,
              {
                id: `c-${Date.now()}`,
                authorName: profile.name,
                authorAvatar: profile.avatar,
                timeAgo: 'Justo ahora',
                content: text.trim(),
              },
            ],
          };
        }
        return p;
      })
    );

    setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
    play('click');
    pillToast.info('Comentario Publicado', 'Tu respuesta se agregó al hilo.');
  };

  // Toggle Follow
  const handleToggleFollow = (followerId: string) => {
    setFollowers((prev) =>
      prev.map((f) => {
        if (f.id === followerId) {
          const nextState = !f.isFollowing;
          play(nextState ? 'pop' : 'click');
          pillToast.info(
            nextState ? `Siguiendo a ${f.name}` : `Dejaste de seguir a ${f.name}`,
            nextState ? 'Recibirás sus actualizaciones en tu feed.' : 'No recibirás más alertas.'
          );
          return { ...f, isFollowing: nextState };
        }
        return f;
      })
    );
  };

  // Filtered Followers
  const filteredFollowers = followers.filter(
    (f) =>
      f.name.toLowerCase().includes(followerSearch.toLowerCase()) ||
      f.role.toLowerCase().includes(followerSearch.toLowerCase()) ||
      f.location.toLowerCase().includes(followerSearch.toLowerCase())
  );

  // Filtered Friends
  const filteredFriends = friends.filter(
    (fr) =>
      fr.name.toLowerCase().includes(friendSearch.toLowerCase()) ||
      fr.role.toLowerCase().includes(friendSearch.toLowerCase()) ||
      fr.department.toLowerCase().includes(friendSearch.toLowerCase())
  );

  // Filtered Gallery
  const filteredGallery = galleryCategory === 'all'
    ? initialGallery
    : initialGallery.filter((g) => g.category.toLowerCase().includes(galleryCategory.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Profile Cover & Header Banner */}
      <Card className="border-border overflow-hidden">
        {/* Cover Image */}
        <div className="relative h-48 sm:h-64 w-full bg-secondary/50 overflow-hidden">
          <img
            src={profile.cover}
            alt="Cover"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
        </div>

        {/* Floating Profile Info Bar */}
        <CardContent className="p-6 pt-0 relative">
          <div className="flex flex-col md:flex-row items-center md:items-end justify-between -mt-16 sm:-mt-20 gap-4 mb-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-left">
              {/* Avatar */}
              <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-3xl border-4 border-card bg-card overflow-hidden shadow-md shrink-0">
                <img
                  src={profile.avatar}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Name & Title */}
              <div className="space-y-1">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    {profile.name}
                  </h2>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {profile.role}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  {profile.handle} • {profile.department}
                </p>
                <p className="text-xs text-muted-foreground">
                  {profile.location}
                </p>
              </div>
            </div>

            {/* Quick Actions & Stats */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Stats Counters */}
              <div className="flex items-center gap-6 px-4 py-2 rounded-2xl bg-secondary/40 border border-border">
                <div className="text-center">
                  <span className="font-mono text-base font-bold text-foreground tabular-nums block">
                    {profile.stats.posts}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono">Posts</span>
                </div>
                <div className="w-px h-7 bg-border" />
                <div className="text-center">
                  <span className="font-mono text-base font-bold text-foreground tabular-nums block">
                    {profile.stats.followers.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono">Seguidores</span>
                </div>
                <div className="w-px h-7 bg-border" />
                <div className="text-center">
                  <span className="font-mono text-base font-bold text-foreground tabular-nums block">
                    {profile.stats.following.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono">Siguiendo</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  soundType="tab"
                  onClick={() => {
                    play('tab');
                    onNavigateToAccount();
                  }}
                  className="text-xs"
                >
                  Editar Perfil
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  soundType="click"
                  onClick={() => {
                    play('click');
                    pillToast.success('Mensaje Enviado', `Se abrió el chat directo con ${profile.name}.`);
                  }}
                  className="text-xs"
                >
                  Mensaje
                </Button>
              </div>
            </div>
          </div>

          {/* Sub-Tabs Pill Navigation */}
          <div className="flex items-center gap-2 border-t border-border/50 pt-4 overflow-x-auto">
            {[
              { id: 'technical', label: 'Ficha Técnica & RBAC', badge: 'Pro' },
              { id: 'feed', label: 'Perfil & Actividad', count: posts.length },
              { id: 'followers', label: 'Seguidores', count: followers.length },
              { id: 'friends', label: 'Conexiones', count: friends.length },
              { id: 'gallery', label: 'Galería Multimedia', count: initialGallery.length },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  play('tab');
                  setActiveSubTab(tab.id as ProfileSubTab);
                }}
                className={cn(
                  'px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5',
                  activeSubTab === tab.id
                    ? 'bg-foreground text-background font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                )}
              >
                {tab.id === 'technical' && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="font-mono text-[9px] px-1.5 py-0.2 rounded-full bg-primary/20 text-primary font-bold">
                    {tab.badge}
                  </span>
                )}
                {tab.count !== undefined && (
                  <span className="font-mono text-[10px] opacity-70 tabular-nums">({tab.count})</span>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* SUB-TAB 0: TECHNICAL DOSSIER & RBAC */}
      {activeSubTab === 'technical' && (
        <div className="space-y-6 animate-fade-in">
          {/* Identity & Corporate Credentials Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Account UUID */}
            <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-2">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span className="font-semibold uppercase tracking-wider text-muted-foreground/80 font-mono text-[10px]">
                  ID de Usuario & Hash
                </span>
                <Fingerprint className="h-4 w-4 text-primary" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs font-mono font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded-lg truncate">
                  USR-9941-BLAKOR
                </code>
                <Button
                  variant="ghost"
                  size="iconSm"
                  soundType="none"
                  onClick={() => {
                    play('pop');
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText('USR-9941-BLAKOR-UUID-8842-A');
                    }
                    setCopiedId(true);
                    pillToast.success('Hash Copiado', 'UUID único de cuenta copiado al portapapeles.');
                    setTimeout(() => setCopiedId(false), 2000);
                  }}
                  className="h-7 w-7 shrink-0 cursor-pointer"
                  title="Copiar UUID"
                >
                  {copiedId ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Clave criptográfica vinculada a JWT</p>
            </div>

            {/* 2. Security Clearance Level */}
            <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-2">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span className="font-semibold uppercase tracking-wider text-muted-foreground/80 font-mono text-[10px]">
                  Nivel de Autorización
                </span>
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold font-heading text-foreground">
                  Nivel 4 (SuperAdmin)
                </span>
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Acceso Root & Auditoría Global
              </p>
            </div>

            {/* 3. License Tier */}
            <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-2">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span className="font-semibold uppercase tracking-wider text-muted-foreground/80 font-mono text-[10px]">
                  Licencia SaaS Activa
                </span>
                <KeyRound className="h-4 w-4 text-primary" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold font-heading text-foreground">
                  Enterprise Unlimited
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                Asiento #LIC-01 (1 de 200)
              </p>
            </div>

            {/* 4. Telemetry Status */}
            <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-2">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span className="font-semibold uppercase tracking-wider text-muted-foreground/80 font-mono text-[10px]">
                  2FA & Sesión Activa
                </span>
                <Activity className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="success" className="text-[10px] font-mono px-2 py-0.5">
                  FIDO2 + TOTP OK
                </Badge>
                <span className="text-xs font-mono text-muted-foreground">IP 192.168.1.104</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Handshake hace 14 min</p>
            </div>
          </div>

          {/* Granular RBAC Permissions Matrix Card */}
          <Card className="border-border">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span>Matriz de Privilegios & Control de Acceso Granular</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Capacidades asignadas conforme a las políticas del clúster institucional
                  </CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  RBAC Directo
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                {[
                  {
                    title: 'Dashboard & Métricas',
                    level: 'Total (Read / Write)',
                    desc: 'Acceso a ingresos, KPIs financieros y telemetría de ventas.',
                    status: 'Permitido',
                  },
                  {
                    title: 'Directorio & Roles de Staff',
                    level: 'Administración Completa',
                    desc: 'Crear, editar, suspender credenciales e invitar personal.',
                    status: 'Permitido',
                  },
                  {
                    title: 'Facturación & Pasarelas',
                    level: 'Supervisión & Reembolsos',
                    desc: 'Emisión de facturas fiscales y conciliación Stripe.',
                    status: 'Permitido',
                  },
                  {
                    title: 'Claves de Licencia SaaS',
                    level: 'Emisión Criptográfica',
                    desc: 'Firma y revocación de seriales para clientes.',
                    status: 'Permitido',
                  },
                  {
                    title: 'Observabilidad & Logs Forenses',
                    level: 'Acceso Total Inmutable',
                    desc: 'Consulta de auditoría y registros de microservicios.',
                    status: 'Permitido',
                  },
                  {
                    title: 'Terminal SSH / Clúster K8s',
                    level: 'Operador Certificado',
                    desc: 'Despliegues continuos, reescalado y reinicio de pods.',
                    status: 'Permitido',
                  },
                ].map((perm, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl border border-border/60 bg-secondary/30 hover:bg-secondary/50 transition-colors space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{perm.title}</span>
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        <Check className="h-2.5 w-2.5" />
                        {perm.status}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-primary font-medium block">
                      {perm.level}
                    </span>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {perm.desc}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Active Workstreams & Hardware Environment */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Active Projects (7 cols) */}
            <Card className="lg:col-span-7 border-border">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-primary" />
                  <span>Proyectos & Workstreams Asignados</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Iniciativas estratégicas bajo su supervisión técnica directa
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4 text-xs">
                {[
                  {
                    name: 'Core Gateway v2.4',
                    role: 'Tech Lead',
                    progress: 92,
                    badge: 'Producción',
                    color: 'bg-emerald-500',
                  },
                  {
                    name: 'Apple HIG Design System',
                    role: 'Owner & Arquitecto UX',
                    progress: 88,
                    badge: 'En Curso',
                    color: 'bg-primary',
                  },
                  {
                    name: 'Integración Pasarelas de Cobro',
                    role: 'Lead Reviewer',
                    progress: 100,
                    badge: 'Completado',
                    color: 'bg-blue-500',
                  },
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-foreground text-xs block">
                          {item.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {item.role}
                        </span>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-[10px] font-mono mb-0.5">
                          {item.badge}
                        </Badge>
                        <span className="block font-mono text-[11px] font-bold text-foreground">
                          {item.progress}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', item.color)}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Hardware Environment & Security Audit (5 cols) */}
            <Card className="lg:col-span-5 border-border flex flex-col justify-between">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-primary" />
                  <span>Entorno de Hardware & Seguridad</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Parámetros verificados de la estación de trabajo
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border/60">
                  <div className="flex items-center gap-2.5">
                    <Laptop className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Dispositivo habitual</span>
                  </div>
                  <span className="font-mono font-medium text-foreground text-[11px]">
                    MacBook Pro M3 Max
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border/60">
                  <div className="flex items-center gap-2.5">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Ubicación de red</span>
                  </div>
                  <span className="font-mono font-medium text-foreground text-[11px]">
                    Madrid, ES (Cloudflare)
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border/60">
                  <div className="flex items-center gap-2.5">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Estado de cifrado</span>
                  </div>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                    FileVault XTS-AES 256
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border/60">
                  <div className="flex items-center gap-2.5">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Vigencia token JWT</span>
                  </div>
                  <span className="font-mono text-foreground font-semibold text-[11px]">
                    6h 45m restantes
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* SUB-TAB 1: FEED & OVERVIEW */}
      {activeSubTab === 'feed' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (4 cols): Bio & Details */}
          <div className="lg:col-span-4 space-y-5">
            {/* Bio Card */}
            <Card className="border-border">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-semibold">Información Biográfica</CardTitle>
                <CardDescription className="text-xs">Perfil profesional y datos de contacto</CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4 text-xs">
                <p className="text-muted-foreground leading-relaxed">
                  {profile.bio}
                </p>

                <div className="space-y-2.5 pt-3 border-t border-border/50 text-[11px]">
                  <div className="flex items-center gap-2.5 text-foreground">
                    <Building className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span>{profile.department}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-foreground">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span>{profile.location}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-foreground">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-mono">{profile.email}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-foreground">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-mono">{profile.phone}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Social Links Card */}
            <Card className="border-border">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-semibold">Redes & Repositorios</CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-2 text-xs">
                {profile.socials.map((soc) => (
                  <a
                    key={soc.name}
                    href={soc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 hover:border-foreground/20 hover:bg-secondary/30 transition-all"
                  >
                    <span className="font-medium text-foreground">{soc.name}</span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                ))}
              </CardContent>
            </Card>

            {/* Colleagues Preview Widget */}
            <Card className="border-border">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Compañeros de Equipo</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveSubTab('friends')}
                    className="text-[11px] text-primary h-7 px-2"
                  >
                    Ver Todos
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-3">
                {friends.slice(0, 4).map((f) => (
                  <div key={f.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={f.avatar}
                        alt={f.name}
                        className="h-8 w-8 rounded-xl object-cover border border-border"
                      />
                      <div>
                        <span className="text-xs font-semibold text-foreground block">{f.name}</span>
                        <span className="text-[10px] text-muted-foreground">{f.role}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] font-mono">
                      {f.department.split(' ')[0]}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right Column (8 cols): Post Box & Timeline */}
          <div className="lg:col-span-8 space-y-6">
            {/* Create Post Box */}
            <Card className="border-border">
              <CardHeader className="pb-2 border-b border-border/50">
                <CardTitle className="text-sm font-semibold">Crear Actualización</CardTitle>
                <CardDescription className="text-xs">
                  Comparte anuncios de ingeniería, diseño o actualizaciones de proyecto
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <form onSubmit={handleCreatePost} className="space-y-3">
                  <textarea
                    rows={3}
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="¿En qué estás trabajando hoy? Comparte avances con el equipo..."
                    className="w-full p-3 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-hidden leading-relaxed resize-none"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      soundType="click"
                      onClick={() => {
                        play('click');
                        pillToast.info('Adjuntar Imagen', 'Selecciona un archivo multimedia de tu equipo.');
                      }}
                      className="text-xs gap-1.5"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      Adjuntar Multimedia
                    </Button>

                    <Button
                      type="submit"
                      variant="default"
                      size="sm"
                      soundType="success"
                      className="text-xs gap-1.5"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Publicar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Posts Feed Timeline */}
            <div className="space-y-5">
              {posts.map((post) => (
                <Card key={post.id} className="border-border overflow-hidden">
                  <CardContent className="p-5 space-y-4">
                    {/* Author Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={post.authorAvatar}
                          alt={post.authorName}
                          className="h-10 w-10 rounded-2xl object-cover border border-border"
                        />
                        <div>
                          <h4 className="text-xs font-bold text-foreground">{post.authorName}</h4>
                          <span className="text-[11px] text-muted-foreground block font-mono">
                            {post.authorRole} • {post.timeAgo}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="iconSm"
                        soundType="click"
                        onClick={() => {
                          play('click');
                          pillToast.info('Enlace Copiado', 'Enlace directo a la publicación copiado.');
                        }}
                      >
                        <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>

                    {/* Content */}
                    <p className="text-xs text-foreground leading-relaxed">
                      {post.content}
                    </p>

                    {/* Optional Post Media */}
                    {post.image && (
                      <div className="rounded-2xl overflow-hidden border border-border bg-secondary/30 max-h-80">
                        <img
                          src={post.image}
                          alt="Post attachment"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Interaction Buttons Bar */}
                    <div className="flex items-center gap-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => handleToggleLike(post.id)}
                        className={cn(
                          'flex items-center gap-1.5 font-medium transition-colors cursor-pointer',
                          post.isLiked ? 'text-red-500 font-bold' : 'hover:text-foreground'
                        )}
                      >
                        <Heart className={cn('h-4 w-4', post.isLiked && 'fill-red-500')} />
                        <span className="font-mono tabular-nums">{post.likesCount} Me gusta</span>
                      </button>

                      <span className="flex items-center gap-1.5">
                        <MessageSquare className="h-4 w-4" />
                        <span className="font-mono tabular-nums">{post.comments.length} Comentarios</span>
                      </span>
                    </div>

                    {/* Comments Thread */}
                    {post.comments.length > 0 && (
                      <div className="space-y-2.5 pt-2 border-t border-border/40">
                        {post.comments.map((c) => (
                          <div key={c.id} className="p-3 rounded-xl bg-secondary/30 flex items-start gap-2.5 text-xs">
                            <img
                              src={c.authorAvatar}
                              alt={c.authorName}
                              className="h-7 w-7 rounded-lg object-cover border border-border shrink-0 mt-0.5"
                            />
                            <div className="flex-1 space-y-0.5">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-foreground text-[11px]">{c.authorName}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">{c.timeAgo}</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-normal">{c.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Comment Input */}
                    <div className="flex items-center gap-2 pt-1">
                      <Input
                        value={commentInputs[post.id] || ''}
                        onChange={(e) =>
                          setCommentInputs({ ...commentInputs, [post.id]: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddComment(post.id);
                          }
                        }}
                        placeholder="Escribe una respuesta técnica..."
                        className="text-xs h-8 bg-background"
                      />
                      <Button
                        variant="default"
                        size="sm"
                        soundType="click"
                        onClick={() => handleAddComment(post.id)}
                        className="text-xs h-8 px-3 shrink-0"
                      >
                        Responder
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: FOLLOWERS */}
      {activeSubTab === 'followers' && (
        <Card className="border-border">
          <CardHeader className="pb-4 border-b border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold">Seguidores del Perfil</CardTitle>
                <CardDescription className="text-xs">
                  Miembros de la comunidad y del equipo que reciben tus publicaciones
                </CardDescription>
              </div>
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={followerSearch}
                  onChange={(e) => setFollowerSearch(e.target.value)}
                  placeholder="Buscar seguidores..."
                  className="pl-9 text-xs h-8 bg-background"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFollowers.map((f) => (
                <div
                  key={f.id}
                  className="p-4 rounded-2xl border border-border bg-card/60 flex items-center justify-between gap-3 hover:border-foreground/20 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={f.avatar}
                      alt={f.name}
                      className="h-10 w-10 rounded-2xl object-cover border border-border shrink-0"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-foreground line-clamp-1">{f.name}</h4>
                      <span className="text-[10px] text-muted-foreground font-mono block">{f.handle}</span>
                      <span className="text-[10px] text-muted-foreground block truncate max-w-[120px]">{f.role}</span>
                    </div>
                  </div>

                  <Button
                    variant={f.isFollowing ? 'outline' : 'default'}
                    size="sm"
                    soundType="pop"
                    onClick={() => handleToggleFollow(f.id)}
                    className="text-[11px] h-8 px-3 shrink-0"
                  >
                    {f.isFollowing ? 'Siguiendo' : 'Seguir'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SUB-TAB 3: FRIENDS & CONNECTIONS */}
      {activeSubTab === 'friends' && (
        <Card className="border-border">
          <CardHeader className="pb-4 border-b border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold">Red de Conexiones & Colaboradores</CardTitle>
                <CardDescription className="text-xs">
                  Colegas con acceso directo y proyectos colaborativos compartidos
                </CardDescription>
              </div>
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  placeholder="Buscar colega..."
                  className="pl-9 text-xs h-8 bg-background"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredFriends.map((fr) => (
                <div
                  key={fr.id}
                  className="p-5 rounded-2xl border border-border bg-card/60 text-center flex flex-col justify-between items-center space-y-3 hover:border-foreground/20 transition-all"
                >
                  <div className="relative">
                    <img
                      src={fr.avatar}
                      alt={fr.name}
                      className="h-16 w-16 rounded-2xl object-cover border border-border mx-auto"
                    />
                    {fr.isOnline && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-card" />
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-foreground">{fr.name}</h4>
                    <span className="text-[11px] text-muted-foreground block">{fr.role}</span>
                    <span className="text-[10px] text-muted-foreground/80 font-mono mt-1 block">
                      {fr.mutualFriends} conexiones mutuas
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    soundType="click"
                    onClick={() => {
                      play('click');
                      pillToast.success('Canal Abierto', `Iniciaste chat con ${fr.name}.`);
                    }}
                    className="w-full text-xs h-8"
                  >
                    Mensaje
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SUB-TAB 4: GALLERY */}
      {activeSubTab === 'gallery' && (
        <Card className="border-border">
          <CardHeader className="pb-4 border-b border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold">Galería Multimedia & Activos de Diseño</CardTitle>
                <CardDescription className="text-xs">
                  Entregables visuales, esquemas de interfaz y prototipos publicados
                </CardDescription>
              </div>

              {/* Category filter pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {['all', 'Design Systems', 'UI Prototypes', 'Audio Engineering', 'eCommerce UX'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      play('tab');
                      setGalleryCategory(cat);
                    }}
                    className={cn(
                      'px-3 py-1 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer',
                      galleryCategory === cat
                        ? 'bg-foreground text-background font-semibold shadow-xs'
                        : 'text-muted-foreground hover:bg-secondary'
                    )}
                  >
                    {cat === 'all' ? 'Todos' : cat}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {filteredGallery.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    play('pop');
                    setSelectedGalleryItem(item);
                  }}
                  className="group rounded-2xl border border-border overflow-hidden bg-card/60 cursor-pointer hover:border-foreground/30 hover:shadow-md transition-all duration-200"
                >
                  <div className="relative aspect-4/3 w-full bg-secondary/30 overflow-hidden">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="h-9 w-9 rounded-full bg-background/90 text-foreground flex items-center justify-center shadow-xs">
                        <Maximize2 className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                  <div className="p-3.5 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                      <span>{item.category}</span>
                      <span>{item.fileSize}</span>
                    </div>
                    <h4 className="text-xs font-semibold text-foreground truncate">{item.title}</h4>
                    <span className="text-[10px] text-muted-foreground block">{item.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gallery Lightbox Modal */}
      {selectedGalleryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-md animate-fade-in">
          <div className="relative max-w-3xl w-full rounded-3xl overflow-hidden border border-border bg-card shadow-2xl">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">{selectedGalleryItem.title}</h3>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {selectedGalleryItem.category} • {selectedGalleryItem.date} • {selectedGalleryItem.fileSize}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGalleryItem(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[70vh] bg-black/40 overflow-hidden flex items-center justify-center">
              <img
                src={selectedGalleryItem.image}
                alt={selectedGalleryItem.title}
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
