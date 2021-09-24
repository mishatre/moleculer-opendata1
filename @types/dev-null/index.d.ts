
declare module 'dev-null' {

    import { Writable } from "stream";

    function devnull(): Writable;

    export default devnull;
}