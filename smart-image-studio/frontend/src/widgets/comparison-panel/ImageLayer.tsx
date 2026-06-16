import { buildTransformStyle, type ViewTransform } from './ComparisonViewport';

export function ImageLayer({
  src,
  alt,
  transform,
  clipPath,
}: {
  src: string;
  alt: string;
  transform: ViewTransform;
  clipPath?: string;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={clipPath ? { clipPath } : undefined}>
      <div className="absolute inset-0" style={buildTransformStyle(transform)}>
        <img
          src={src}
          alt={alt}
          crossOrigin="anonymous"
          draggable={false}
          className="h-full w-full select-none object-contain pointer-events-none"
        />
      </div>
    </div>
  );
}
