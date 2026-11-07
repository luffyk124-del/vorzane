import { ScrollViewStyleReset, useServerDocumentContext } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function RootDocument({ children }: PropsWithChildren) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();

  return (
    <html {...htmlAttributes} lang="ar" dir="rtl">
      <head>
        {headNodes}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#080C12" />
        <meta name="description" content="VORZANE — مغامرة فانتازيا عربية، وتقدم محفوظ لكل لاعب." />
        <title>VORZANE — مغامرة فانتازيا عربية</title>
        <link rel="icon" href={`${process.env.EXPO_PUBLIC_BASE_PATH ?? ""}/favicon.svg`} type="image/svg+xml" />
        <ScrollViewStyleReset />
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
