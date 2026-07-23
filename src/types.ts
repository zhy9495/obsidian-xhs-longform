export type StyleId = "pingfang" | "handwrite";
export type TextureId = "auto" | "none" | "grid" | "dot" | "line";
export type SizeScale = "80" | "90" | "100" | "110";
export type PageMargin = "64" | "76" | "88" | "100" | "112";
export type CoverMode = "avatar-body" | "avatar-title-body" | "title-body";
export type AvatarSize = "small" | "medium" | "large";

export type Inline =
  | { type: "text"; text: string }
  | { type: "bold" | "italic" | "highlight" | "code"; children: Inline[] };

export type TextBlock = {
  type: "cover-title" | "subtitle" | "paragraph" | "quote" | "code-block";
  inlines: Inline[];
  headingLevel?: 1 | 2 | 3;
  continuedFromPrevious?: boolean;
  continuesNext?: boolean;
};

export type ListBlock = {
  type: "list";
  ordered: boolean;
  items: Inline[][];
  continuedFromPrevious?: boolean;
  continuesNext?: boolean;
};

export type TableBlock = {
  type: "table";
  header: Inline[][];
  rows: Inline[][][];
};

export type ImageBlock = { type: "image"; link: string; alt: string; dataUri?: string };
export type ImagePairBlock = { type: "image-pair"; images: [ImageBlock, ImageBlock] };
export type MotionBlock = {
  type: "motion";
  id: string;
  link: string;
  alt: string;
  format: "gif" | "mp4" | "mov";
  resourceUrl?: string;
  filePath?: string;
};
export type SpacerBlock = { type: "spacer" };
export type AuthorBlock = { type: "author"; nickname: string; subtitle: string; showText: boolean; avatarDataUrl: string };
export type Block = TextBlock | ListBlock | TableBlock | ImageBlock | ImagePairBlock | MotionBlock | SpacerBlock | AuthorBlock;

export type Page = { blocks: Block[] };

export type ExportOptions = {
  account: string;
  style: StyleId;
  paletteId: string;
  fontId: string;
  texture: TextureId;
  titleScale: SizeScale;
  subtitleScale: SizeScale;
  bodyScale: SizeScale;
  horizontalMargin: PageMargin;
  topMargin: PageMargin;
  showAvatar: boolean;
  showTitle: boolean;
  avatarDataUrl: string;
  avatarSize: AvatarSize;
  authorSubtitle: string;
  coverImageDataUrl: string;
  showCoverImage: boolean;
};
