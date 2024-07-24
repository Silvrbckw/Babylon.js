/**
 * Class used to store core node based material build state
 */
export class CoreNodeMaterialBuildState {
    /** @internal */
    public _builtCompilationString = "";

    /**
     * Gets the emitted compilation strings
     */
    public compilationString = "";

    /**
     * Gets the list of emitted uniforms
     */
    public uniforms: string[] = [];

    /**
     * Gets the list of emitted samplers
     */
    public samplers: string[] = [];

    /**
     * Gets the list of emitted attributes
     */
    public attributes: string[] = [];
}
