export type StyleId = "pingfang" | "handwrite";
export type TextureId = "auto" | "none" | "grid" | "dot" | "line";
export type SizeScale = "80" | "90" | "100" | "110";

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
export type SpacerBlock = { type: "spacer" };
export type Block = TextBlock | ListBlock | TableBlock | ImageBlock | ImagePairBlock | SpacerBlock;

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
};
