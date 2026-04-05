declare module "picomatch" {
  interface Options {
    dot?: boolean;
    matchBase?: boolean;
  }
  function picomatch(glob: string, options?: Options): (input: string) => boolean;
  export default picomatch;
}
