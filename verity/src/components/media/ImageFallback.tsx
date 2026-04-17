"use client";
import Image, { ImageProps } from "next/image";
import { useState } from "react";

export default function ImageFallback(props: ImageProps & { fallback?: string }) {
  const { fallback = "/avatar-fallback.png", alt, ...rest } = props;
  const [src, setSrc] = useState(props.src);
  return (
    <Image {...rest} alt={alt} src={src} onError={() => setSrc(fallback)} />
  );
}
