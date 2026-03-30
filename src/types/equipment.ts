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

export const CABLE_ATTACHMENTS: Attachment[] = [
  { id: 'rope', name: 'Rope', description: 'Tricep rope attachment' },
  { id: 'v-bar', name: 'V-Bar', description: 'V-shaped bar' },
  { id: 'straight-bar', name: 'Straight Bar', description: 'Straight pull-down bar' },
  { id: 'd-handle', name: 'D-Handle', description: 'Single D-handle (pair)' },
  { id: 'ankle-strap', name: 'Ankle Strap', description: 'Ankle strap for leg work' },
  { id: 'belt', name: 'Belt', description: 'Dip/pull-up belt' },
  { id: 'lat-bar', name: 'Lat Bar', description: 'Wide lat pulldown bar' },
  { id: 'ez-bar', name: 'EZ-Bar', description: 'Angled EZ curl bar' },
  { id: 'row-handle', name: 'Row Handle', description: 'Seated row close-grip handle' },
];
