import { sileo, SileoOptions } from 'sileo';
import { sound } from './sound';

export type NotifyType = 'success' | 'error' | 'warning' | 'info';

export interface AppNotificationOptions extends SileoOptions {
  id?: string;
}

const generateId = () => `sileo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function parseNotificationPayload(
  optsOrTitle: AppNotificationOptions | string,
  description?: string,
  defaultDuration = 3500
): SileoOptions {
  if (typeof optsOrTitle === 'object') {
    return {
      duration: optsOrTitle.duration ?? defaultDuration,
      ...optsOrTitle,
    };
  }

  let finalTitle = optsOrTitle.trim();
  let finalDesc = description?.trim();

  // If no description provided, smartly split long single strings to avoid Sileo Dynamic Island overflow
  if (!finalDesc) {
    if (finalTitle.includes(':')) {
      const parts = finalTitle.split(':');
      finalTitle = parts[0].trim();
      finalDesc = parts.slice(1).join(':').trim();
    } else if (finalTitle.includes(' — ')) {
      const parts = finalTitle.split(' — ');
      finalTitle = parts[0].trim();
      finalDesc = parts.slice(1).join(' — ').trim();
    } else if (finalTitle.length > 25) {
      const words = finalTitle.split(' ');
      if (words.length > 3) {
        finalTitle = words.slice(0, 3).join(' ');
        finalDesc = words.slice(3).join(' ');
      }
    }
  }

  return {
    title: finalTitle,
    description: finalDesc,
    duration: defaultDuration,
  };
}

export const notify = {
  success: (
    optsOrTitle: AppNotificationOptions | string,
    description?: string,
    duration?: number
  ) => {
    sound.play('success');
    const options = parseNotificationPayload(optsOrTitle, description, duration ?? 3500);
    return sileo.success(options);
  },

  error: (
    optsOrTitle: AppNotificationOptions | string,
    description?: string,
    duration?: number
  ) => {
    sound.play('alert');
    const options = parseNotificationPayload(optsOrTitle, description, duration ?? 4000);
    return sileo.error(options);
  },

  warning: (
    optsOrTitle: AppNotificationOptions | string,
    description?: string,
    duration?: number
  ) => {
    sound.play('alert');
    const options = parseNotificationPayload(optsOrTitle, description, duration ?? 3500);
    return sileo.warning(options);
  },

  info: (
    optsOrTitle: AppNotificationOptions | string,
    description?: string,
    duration?: number
  ) => {
    sound.play('pop');
    const options = parseNotificationPayload(optsOrTitle, description, duration ?? 3500);
    return sileo.info(options);
  },

  action: (opts: AppNotificationOptions) => {
    sound.play('pop');
    return sileo.action({
      id: opts.id || generateId(),
      duration: opts.duration ?? 4500,
      ...opts,
    } as SileoOptions);
  },

  promise: <T>(
    promise: Promise<T> | (() => Promise<T>),
    opts: Parameters<typeof sileo.promise>[1]
  ) => {
    sound.play('pop');
    return sileo.promise(promise, opts);
  },

  dismiss: (id?: string) => {
    if (id) {
      sileo.dismiss(id);
    } else {
      sileo.clear();
    }
  },

  clear: () => sileo.clear(),
};
