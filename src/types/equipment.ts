export type AttachmentType =
  | 'rope'
  | 'v-bar'
  | 'straight-bar'
  | 'd-handle'
  | 'ankle-strap'
  | 'belt'
  | 'lat-bar'
  | 'ez-bar'
  | 'row-handle';

export interface Attachment {
  id: AttachmentType;
  name: string;
  description: string;
}

export { CABLE_ATTACHMENTS_DATA as CABLE_ATTACHMENTS } from '@/data/tytax/attachments';
