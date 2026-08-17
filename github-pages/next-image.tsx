import type { ImgHTMLAttributes } from "react";

type StaticImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean;
};

export default function StaticImage({ fill, alt = "", ...props }: StaticImageProps) {
  void fill;
  // The GitHub Pages build is static and cannot use Next.js image optimization.
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} {...props} />;
}
