/// <reference types="vite/client" />

// Asset module declarations ensure TypeScript understands bundler-imported static files
// used across legacy and single-pane feature surfaces.
declare module '*.csv?raw' {
  const content: string
  export default content
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.jpeg' {
  const src: string
  export default src
}

declare module '*.webp' {
  const src: string
  export default src
}

declare module '*.gif' {
  const src: string
  export default src
}

declare module '*.svg' {
  const src: string
  export default src
}
