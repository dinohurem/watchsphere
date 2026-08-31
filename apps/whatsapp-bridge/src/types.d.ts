declare module 'qrcode-terminal' {
  interface GenerateOptions {
    small?: boolean;
  }
  function generate(text: string, options?: GenerateOptions, callback?: (qr: string) => void): void;
  export default { generate };
  export { generate };
}
