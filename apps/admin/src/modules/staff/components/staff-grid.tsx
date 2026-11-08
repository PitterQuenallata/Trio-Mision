import React from 'react';
import { Card } from '../../../shared/components/ui/card';
import { Badge } from '../../../shared/components/ui/badge';
import { StaffMember } from '../types/staff.types';
import { cn } from '../../../shared/lib/utils';

interface StaffGridProps {
  members: StaffMember[];
}

export const StaffGrid: React.FC<StaffGridProps> = ({ members }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {members.map((member) => (
        <Card
          key={member.id}
          className="p-5 flex flex-col justify-between rounded-2xl border-border/50 bg-card/70 backdrop-blur-xl hover:border-primary/40 transition-all"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-xs font-mono">
                {member.avatar}
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] font-mono px-2 py-0',
                  member.twoFactor
                    ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5'
                    : 'border-amber-500/30 text-amber-500 bg-amber-500/5'
                )}
              >
                {member.twoFactor ? '2FA Activo' : '2FA Pendiente'}
              </Badge>
            </div>
            <h4 className="mt-3 font-semibold text-sm text-foreground">
              {member.name}
            </h4>
            <p className="text-xs text-muted-foreground font-mono">
              {member.email}
            </p>
            <div className="mt-3 text-xs font-medium text-primary bg-primary/5 py-1 px-2.5 rounded-lg inline-block border border-primary/20">
              {member.role}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border/40 flex justify-between items-center text-[11px] text-muted-foreground font-mono tabular-nums">
            <span>{member.access}</span>
            <span>{member.lastActive}</span>
          </div>
        </Card>
      ))}
    </div>
  );
};
