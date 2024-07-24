/* eslint-disable @typescript-eslint/naming-convention */
import type { NodeMaterialBlock } from "./nodeMaterialBlock";
import type { Scene } from "../../scene";
import type { AbstractMesh } from "../../Meshes/abstractMesh";
import { Vector2 } from "../../Maths/math.vector";
import { Color3, Color4 } from "../../Maths/math.color";
import { Mesh } from "../../Meshes/mesh";
import { NodeMaterialBuildState } from "./nodeMaterialBuildState";
import { Effect } from "../effect";
import type { BaseTexture } from "../../Materials/Textures/baseTexture";
import type { Observer } from "../../Misc/observable";
import { Observable } from "../../Misc/observable";
import { NodeMaterialBlockTargets } from "./Enums/nodeMaterialBlockTargets";
import { NodeMaterialBuildStateSharedData } from "./nodeMaterialBuildStateSharedData";
import type { SubMesh } from "../../Meshes/subMesh";
import type { NodeMaterialOptimizer } from "./Optimizers/nodeMaterialOptimizer";
import type { ImageProcessingConfiguration } from "../imageProcessingConfiguration";
import type { Nullable } from "../../types";
import { VertexBuffer } from "../../Buffers/buffer";
import { Tools } from "../../Misc/tools";
import { TransformBlock } from "./Blocks/transformBlock";
import { VertexOutputBlock } from "./Blocks/Vertex/vertexOutputBlock";
import { FragmentOutputBlock } from "./Blocks/Fragment/fragmentOutputBlock";
import { InputBlock } from "./Blocks/Input/inputBlock";
import { GetClass, RegisterClass } from "../../Misc/typeStore";
import { serialize } from "../../Misc/decorators";
import { SerializationHelper } from "../../Misc/decorators.serialization";
import type { TextureBlock } from "./Blocks/Dual/textureBlock";
import type { ReflectionTextureBaseBlock } from "./Blocks/Dual/reflectionTextureBaseBlock";
import type { RefractionBlock } from "./Blocks/PBR/refractionBlock";
import { CurrentScreenBlock } from "./Blocks/Dual/currentScreenBlock";
import { ParticleTextureBlock } from "./Blocks/Particle/particleTextureBlock";
import { ParticleRampGradientBlock } from "./Blocks/Particle/particleRampGradientBlock";
import { ParticleBlendMultiplyBlock } from "./Blocks/Particle/particleBlendMultiplyBlock";
import { WebRequest } from "../../Misc/webRequest";
import type { PostProcessOptions } from "../../PostProcesses/postProcess";
import { PostProcess } from "../../PostProcesses/postProcess";
import { Constants } from "../../Engines/constants";
import type { Camera } from "../../Cameras/camera";
import { VectorMergerBlock } from "./Blocks/vectorMergerBlock";
import { RemapBlock } from "./Blocks/remapBlock";
import { MultiplyBlock } from "./Blocks/multiplyBlock";
import { NodeMaterialModes } from "./Enums/nodeMaterialModes";
import { Texture } from "../Textures/texture";
import type { IParticleSystem } from "../../Particles/IParticleSystem";
import { BaseParticleSystem } from "../../Particles/baseParticleSystem";
import { ColorSplitterBlock } from "./Blocks/colorSplitterBlock";
import { TimingTools } from "../../Misc/timingTools";
import { ProceduralTexture } from "../Textures/Procedurals/proceduralTexture";
import { AnimatedInputBlockTypes } from "./Blocks/Input/animatedInputBlockTypes";
import { TrigonometryBlock, TrigonometryBlockOperations } from "./Blocks/trigonometryBlock";
import { NodeMaterialSystemValues } from "./Enums/nodeMaterialSystemValues";
import type { ImageSourceBlock } from "./Blocks/Dual/imageSourceBlock";
import { EngineStore } from "../../Engines/engineStore";
import type { Material } from "../material";
import type { TriPlanarBlock } from "./Blocks/triPlanarBlock";
import type { BiPlanarBlock } from "./Blocks/biPlanarBlock";
import type { PrePassRenderer } from "../../Rendering/prePassRenderer";
import type { PrePassTextureBlock } from "./Blocks/Input/prePassTextureBlock";
import type { PrePassOutputBlock } from "./Blocks/Fragment/prePassOutputBlock";
import type { NodeMaterialTeleportOutBlock } from "./Blocks/Teleport/teleportOutBlock";
import type { NodeMaterialTeleportInBlock } from "./Blocks/Teleport/teleportInBlock";
import { Logger } from "core/Misc/logger";
import { ShaderLanguage } from "../shaderLanguage";
import { AbstractEngine } from "../../Engines/abstractEngine";
import { CoreNodeMaterial, NodeMaterialDefines } from "./coreNodeMaterial";

// declare NODEEDITOR namespace for compilation issue
declare let NODEEDITOR: any;
declare let BABYLON: any;

/**
 * Interface used to configure the node material editor
 */
export interface INodeMaterialEditorOptions {
    /** Define the URL to load node editor script from */
    editorURL?: string;
    /** Additional configuration for the NME */
    nodeEditorConfig?: {
        backgroundColor?: Color4;
    };
}

/**
 * Class used to configure NodeMaterial
 */
export interface INodeMaterialOptions {
    /**
     * Defines if blocks should emit comments
     */
    emitComments: boolean;
    /** Defines shader language to use (default to GLSL) */
    shaderLanguage: ShaderLanguage;
}

/**
 * Blocks that manage a texture
 */
export type NodeMaterialTextureBlocks =
    | TextureBlock
    | ReflectionTextureBaseBlock
    | RefractionBlock
    | CurrentScreenBlock
    | ParticleTextureBlock
    | ImageSourceBlock
    | TriPlanarBlock
    | BiPlanarBlock
    | PrePassTextureBlock;

/**
 * Class used to create a node based material built by assembling shader blocks
 */
export class NodeMaterial extends CoreNodeMaterial {
    private static _BuildIdGenerator: number = 0;
    private _options: INodeMaterialOptions;
    private _sharedData: NodeMaterialBuildStateSharedData;
    private _buildId: number = NodeMaterial._BuildIdGenerator++;
    private _buildWasSuccessful = false;
    private _optimizers = new Array<NodeMaterialOptimizer>();
    private _animationFrame = -1;

    /** Define the Url to load node editor script */
    public static EditorURL = `${Tools._DefaultCdnUrl}/v${AbstractEngine.Version}/nodeEditor/babylon.nodeEditor.js`;

    /** Define the Url to load snippets */
    public static SnippetUrl = Constants.SnippetUrl;

    /** Gets or sets a boolean indicating that node materials should not deserialize textures from json / snippet content */
    public static IgnoreTexturesAtLoadTime = false;

    /**
     * Checks if a block is a texture block
     * @param block The block to check
     * @returns True if the block is a texture block
     */
    public static _BlockIsTextureBlock(block: NodeMaterialBlock): block is NodeMaterialTextureBlocks {
        return (
            block.getClassName() === "TextureBlock" ||
            block.getClassName() === "ReflectionTextureBaseBlock" ||
            block.getClassName() === "ReflectionTextureBlock" ||
            block.getClassName() === "ReflectionBlock" ||
            block.getClassName() === "RefractionBlock" ||
            block.getClassName() === "CurrentScreenBlock" ||
            block.getClassName() === "ParticleTextureBlock" ||
            block.getClassName() === "ImageSourceBlock" ||
            block.getClassName() === "TriPlanarBlock" ||
            block.getClassName() === "BiPlanarBlock" ||
            block.getClassName() === "PrePassTextureBlock"
        );
    }

    private BJSNODEMATERIALEDITOR = this._getGlobalNodeMaterialEditor();

    /** Get the inspector from bundle or global
     * @returns the global NME
     */
    private _getGlobalNodeMaterialEditor(): any {
        // UMD Global name detection from Webpack Bundle UMD Name.
        if (typeof NODEEDITOR !== "undefined") {
            return NODEEDITOR;
        }

        // In case of module let's check the global emitted from the editor entry point.
        if (typeof BABYLON !== "undefined" && typeof BABYLON.NodeEditor !== "undefined") {
            return BABYLON;
        }

        return undefined;
    }

    /** Gets or sets the active shader language */
    public override get shaderLanguage(): ShaderLanguage {
        return this._options.shaderLanguage;
    }

    public override set shaderLanguage(value: ShaderLanguage) {
        this._options.shaderLanguage = value;
    }

    /**
     * Snippet ID if the material was created from the snippet server
     */
    public snippetId: string;

    /**
     * Gets or sets data used by visual editor
     * @see https://nme.babylonjs.com
     */
    public editorData: any = null;

    /**
     * Gets or sets a boolean indicating that alpha value must be ignored (This will turn alpha blending off even if an alpha value is produced by the material)
     */
    @serialize()
    public ignoreAlpha = false;

    /**
     * Defines the maximum number of lights that can be used in the material
     */
    @serialize()
    public override maxSimultaneousLights = 4;

    /**
     * Observable raised when the material is built
     */
    public onBuildObservable = new Observable<NodeMaterial>();

    /**
     * Gets or sets the root nodes of the material vertex shader
     */
    public _vertexOutputNodes = new Array<NodeMaterialBlock>();

    /**
     * Gets or sets the root nodes of the material fragment (pixel) shader
     */
    public _fragmentOutputNodes = new Array<NodeMaterialBlock>();

    /** Gets or sets options to control the node material overall behavior */
    public get options() {
        return this._options;
    }

    public set options(options: INodeMaterialOptions) {
        this._options = options;
    }

    /**
     * Default configuration related to image processing available in the standard Material.
     */
    protected _imageProcessingConfiguration: ImageProcessingConfiguration;

    /**
     * Gets the image processing configuration used either in this material.
     */
    public get imageProcessingConfiguration(): ImageProcessingConfiguration {
        return this._imageProcessingConfiguration;
    }

    /**
     * Sets the Default image processing configuration used either in the this material.
     *
     * If sets to null, the scene one is in use.
     */
    public set imageProcessingConfiguration(value: ImageProcessingConfiguration) {
        this._attachImageProcessingConfiguration(value);

        // Ensure the effect will be rebuilt.
        this._markAllSubMeshesAsTexturesDirty();
    }

    /**
     * Gets an array of blocks that needs to be serialized even if they are not yet connected
     */
    public attachedBlocks: NodeMaterialBlock[] = [];

    /**
     * Specifies the mode of the node material
     * @internal
     */
    @serialize("mode")
    public _mode: NodeMaterialModes = NodeMaterialModes.Material;

    /**
     * Gets or sets the mode property
     */
    public get mode(): NodeMaterialModes {
        return this._mode;
    }

    public set mode(value: NodeMaterialModes) {
        this._mode = value;
    }

    /** Gets or sets the unique identifier used to identified the effect associated with the material */
    public get buildId() {
        return this._buildId;
    }

    public set buildId(value: number) {
        this._buildId = value;
    }

    /**
     * A free comment about the material
     */
    @serialize("comment")
    public comment: string;

    /**
     * Create a new node based material
     * @param name defines the material name
     * @param scene defines the hosting scene
     * @param options defines creation option
     */
    constructor(name: string, scene?: Scene, options: Partial<INodeMaterialOptions> = {}) {
        super(name, scene || EngineStore.LastCreatedScene!);

        if (options && options.shaderLanguage === ShaderLanguage.WGSL && !this.getScene().getEngine().isWebGPU) {
            throw new Error("WebGPU shader language is only supported with WebGPU engine");
        }

        this._options = {
            emitComments: false,
            shaderLanguage: NodeMaterial.DefaultShaderLanguage,
            ...options,
        };

        // Setup the default processing configuration to the scene.
        this._attachImageProcessingConfiguration(null);
    }

    /**
     * Gets the current class name of the material e.g. "NodeMaterial"
     * @returns the class name
     */
    public override getClassName(): string {
        return "NodeMaterial";
    }

    /**
     * Keep track of the image processing observer to allow dispose and replace.
     */
    private _imageProcessingObserver: Nullable<Observer<ImageProcessingConfiguration>>;

    /**
     * Attaches a new image processing configuration to the Standard Material.
     * @param configuration
     */
    protected _attachImageProcessingConfiguration(configuration: Nullable<ImageProcessingConfiguration>): void {
        if (configuration === this._imageProcessingConfiguration) {
            return;
        }

        // Detaches observer.
        if (this._imageProcessingConfiguration && this._imageProcessingObserver) {
            this._imageProcessingConfiguration.onUpdateParameters.remove(this._imageProcessingObserver);
        }

        // Pick the scene configuration if needed.
        if (!configuration) {
            this._imageProcessingConfiguration = this.getScene().imageProcessingConfiguration;
        } else {
            this._imageProcessingConfiguration = configuration;
        }

        // Attaches observer.
        if (this._imageProcessingConfiguration) {
            this._imageProcessingObserver = this._imageProcessingConfiguration.onUpdateParameters.add(() => {
                this._markAllSubMeshesAsImageProcessingDirty();
            });
        }
    }

    /**
     * Get a block by its name
     * @param name defines the name of the block to retrieve
     * @returns the required block or null if not found
     */
    public getBlockByName(name: string) {
        let result = null;
        for (const block of this.attachedBlocks) {
            if (block.name === name) {
                if (!result) {
                    result = block;
                } else {
                    Tools.Warn("More than one block was found with the name `" + name + "`");
                    return result;
                }
            }
        }

        return result;
    }

    /**
     * Get a block using a predicate
     * @param predicate defines the predicate used to find the good candidate
     * @returns the required block or null if not found
     */
    public getBlockByPredicate(predicate: (block: NodeMaterialBlock) => boolean) {
        for (const block of this.attachedBlocks) {
            if (predicate(block)) {
                return block;
            }
        }

        return null;
    }

    /**
     * Get an input block using a predicate
     * @param predicate defines the predicate used to find the good candidate
     * @returns the required input block or null if not found
     */
    public getInputBlockByPredicate(predicate: (block: InputBlock) => boolean): Nullable<InputBlock> {
        for (const block of this.attachedBlocks) {
            if (block.isInput && predicate(block as InputBlock)) {
                return block as InputBlock;
            }
        }

        return null;
    }

    /**
     * Gets the list of input blocks attached to this material
     * @returns an array of InputBlocks
     */
    public getInputBlocks() {
        const blocks: InputBlock[] = [];
        for (const block of this.attachedBlocks) {
            if (block.isInput) {
                blocks.push(block as InputBlock);
            }
        }

        return blocks;
    }

    /**
     * Adds a new optimizer to the list of optimizers
     * @param optimizer defines the optimizers to add
     * @returns the current material
     */
    public registerOptimizer(optimizer: NodeMaterialOptimizer) {
        const index = this._optimizers.indexOf(optimizer);

        if (index > -1) {
            return;
        }

        this._optimizers.push(optimizer);

        return this;
    }

    /**
     * Remove an optimizer from the list of optimizers
     * @param optimizer defines the optimizers to remove
     * @returns the current material
     */
    public unregisterOptimizer(optimizer: NodeMaterialOptimizer) {
        const index = this._optimizers.indexOf(optimizer);

        if (index === -1) {
            return;
        }

        this._optimizers.splice(index, 1);

        return this;
    }

    /**
     * Add a new block to the list of output nodes
     * @param node defines the node to add
     * @returns the current material
     */
    public addOutputNode(node: NodeMaterialBlock) {
        if (node.target === null) {
            // eslint-disable-next-line no-throw-literal
            throw "This node is not meant to be an output node. You may want to explicitly set its target value.";
        }

        if ((node.target & NodeMaterialBlockTargets.Vertex) !== 0) {
            this._addVertexOutputNode(node);
        }

        if ((node.target & NodeMaterialBlockTargets.Fragment) !== 0) {
            this._addFragmentOutputNode(node);
        }

        return this;
    }

    /**
     * Remove a block from the list of root nodes
     * @param node defines the node to remove
     * @returns the current material
     */
    public removeOutputNode(node: NodeMaterialBlock) {
        if (node.target === null) {
            return this;
        }

        if ((node.target & NodeMaterialBlockTargets.Vertex) !== 0) {
            this._removeVertexOutputNode(node);
        }

        if ((node.target & NodeMaterialBlockTargets.Fragment) !== 0) {
            this._removeFragmentOutputNode(node);
        }

        return this;
    }

    private _addVertexOutputNode(node: NodeMaterialBlock) {
        if (this._vertexOutputNodes.indexOf(node) !== -1) {
            return;
        }

        node.target = NodeMaterialBlockTargets.Vertex;
        this._vertexOutputNodes.push(node);

        return this;
    }

    private _removeVertexOutputNode(node: NodeMaterialBlock) {
        const index = this._vertexOutputNodes.indexOf(node);
        if (index === -1) {
            return;
        }

        this._vertexOutputNodes.splice(index, 1);

        return this;
    }

    private _addFragmentOutputNode(node: NodeMaterialBlock) {
        if (this._fragmentOutputNodes.indexOf(node) !== -1) {
            return;
        }

        node.target = NodeMaterialBlockTargets.Fragment;
        this._fragmentOutputNodes.push(node);

        return this;
    }

    private _removeFragmentOutputNode(node: NodeMaterialBlock) {
        const index = this._fragmentOutputNodes.indexOf(node);
        if (index === -1) {
            return;
        }

        this._fragmentOutputNodes.splice(index, 1);

        return this;
    }

    /**
     * Gets or sets a boolean indicating that alpha blending must be enabled no matter what alpha value or alpha channel of the FragmentBlock are
     */
    @serialize()
    public forceAlphaBlending = false;

    /**
     * Specifies if the material will require alpha blending
     * @returns a boolean specifying if alpha blending is needed
     */
    public override needAlphaBlending(): boolean {
        if (this.ignoreAlpha) {
            return false;
        }
        return this.forceAlphaBlending || this.alpha < 1.0 || (this._sharedData && this._sharedData.hints.needAlphaBlending);
    }

    /**
     * Specifies if this material should be rendered in alpha test mode
     * @returns a boolean specifying if an alpha test is needed.
     */
    public override needAlphaTesting(): boolean {
        return this._sharedData && this._sharedData.hints.needAlphaTesting;
    }

    private _processInitializeOnLink(block: NodeMaterialBlock, state: NodeMaterialBuildState, nodesToProcessForOtherBuildState: NodeMaterialBlock[], autoConfigure = true) {
        if (block.target === NodeMaterialBlockTargets.VertexAndFragment) {
            nodesToProcessForOtherBuildState.push(block);
        } else if (state.target === NodeMaterialBlockTargets.Fragment && block.target === NodeMaterialBlockTargets.Vertex && block._preparationId !== this._buildId) {
            nodesToProcessForOtherBuildState.push(block);
        }
        this._initializeBlock(block, state, nodesToProcessForOtherBuildState, autoConfigure);
    }

    private _initializeBlock(node: NodeMaterialBlock, state: NodeMaterialBuildState, nodesToProcessForOtherBuildState: NodeMaterialBlock[], autoConfigure = true) {
        node.initialize(state);
        if (autoConfigure) {
            node.autoConfigure(this);
        }
        node._preparationId = this._buildId;

        if (this.attachedBlocks.indexOf(node) === -1) {
            if (node.isUnique) {
                const className = node.getClassName();

                for (const other of this.attachedBlocks) {
                    if (other.getClassName() === className) {
                        // eslint-disable-next-line no-throw-literal
                        throw `Cannot have multiple blocks of type ${className} in the same NodeMaterial`;
                    }
                }
            }
            this.attachedBlocks.push(node);
        }

        for (const input of node.inputs) {
            input.associatedVariableName = "";

            const connectedPoint = input.connectedPoint;
            if (connectedPoint) {
                const block = connectedPoint.ownerBlock;
                if (block !== node) {
                    this._processInitializeOnLink(block, state, nodesToProcessForOtherBuildState, autoConfigure);
                }
            }
        }

        // Teleportation
        if (node.isTeleportOut) {
            const teleport = node as NodeMaterialTeleportOutBlock;
            if (teleport.entryPoint) {
                this._processInitializeOnLink(teleport.entryPoint, state, nodesToProcessForOtherBuildState, autoConfigure);
            }
        }

        for (const output of node.outputs) {
            output.associatedVariableName = "";
        }
    }

    private _resetDualBlocks(node: NodeMaterialBlock, id: number) {
        if (node.target === NodeMaterialBlockTargets.VertexAndFragment) {
            node.buildId = id;
        }

        for (const inputs of node.inputs) {
            const connectedPoint = inputs.connectedPoint;
            if (connectedPoint) {
                const block = connectedPoint.ownerBlock;
                if (block !== node) {
                    this._resetDualBlocks(block, id);
                }
            }
        }

        // If this is a teleport out, we need to reset the connected block
        if (node.isTeleportOut) {
            const teleportOut = node as NodeMaterialTeleportOutBlock;
            if (teleportOut.entryPoint) {
                this._resetDualBlocks(teleportOut.entryPoint, id);
            }
        }
    }

    /**
     * Remove a block from the current node material
     * @param block defines the block to remove
     */
    public removeBlock(block: NodeMaterialBlock) {
        const attachedBlockIndex = this.attachedBlocks.indexOf(block);
        if (attachedBlockIndex > -1) {
            this.attachedBlocks.splice(attachedBlockIndex, 1);
        }

        if (block.isFinalMerger) {
            this.removeOutputNode(block);
        }
    }

    /**
     * Build the material and generates the inner effect
     * @param verbose defines if the build should log activity
     * @param updateBuildId defines if the internal build Id should be updated (default is true)
     * @param autoConfigure defines if the autoConfigure method should be called when initializing blocks (default is false)
     */
    public build(verbose: boolean = false, updateBuildId = true, autoConfigure = false) {
        // First time?
        if (!this._vertexCompilationState && !autoConfigure) {
            autoConfigure = true;
        }

        this._buildWasSuccessful = false;
        const engine = this.getScene().getEngine();

        const allowEmptyVertexProgram = this._mode === NodeMaterialModes.Particle;

        if (this._vertexOutputNodes.length === 0 && !allowEmptyVertexProgram) {
            // eslint-disable-next-line no-throw-literal
            throw "You must define at least one vertexOutputNode";
        }

        if (this._fragmentOutputNodes.length === 0) {
            // eslint-disable-next-line no-throw-literal
            throw "You must define at least one fragmentOutputNode";
        }

        // Compilation state
        this._vertexCompilationState = new NodeMaterialBuildState();
        const vertexCompilationState = this._vertexCompilationState as NodeMaterialBuildState;
        vertexCompilationState.supportUniformBuffers = engine.supportsUniformBuffers;
        vertexCompilationState.target = NodeMaterialBlockTargets.Vertex;
        this._fragmentCompilationState = new NodeMaterialBuildState();
        const fragmentCompilationState = this._fragmentCompilationState as NodeMaterialBuildState;
        fragmentCompilationState.supportUniformBuffers = engine.supportsUniformBuffers;
        fragmentCompilationState.target = NodeMaterialBlockTargets.Fragment;

        // Shared data
        this._sharedData = new NodeMaterialBuildStateSharedData();
        this._sharedData.nodeMaterial = this;
        this._sharedData.fragmentOutputNodes = this._fragmentOutputNodes;
        vertexCompilationState.sharedData = this._sharedData;
        fragmentCompilationState.sharedData = this._sharedData;
        this._sharedData.buildId = this._buildId;
        this._sharedData.emitComments = this._options.emitComments;
        this._sharedData.verbose = verbose;
        this._sharedData.scene = this.getScene();
        this._sharedData.allowEmptyVertexProgram = allowEmptyVertexProgram;

        // Initialize blocks
        const vertexNodes: NodeMaterialBlock[] = [];
        const fragmentNodes: NodeMaterialBlock[] = [];

        for (const vertexOutputNode of this._vertexOutputNodes) {
            vertexNodes.push(vertexOutputNode);
            this._initializeBlock(vertexOutputNode, vertexCompilationState, fragmentNodes, autoConfigure);
        }

        for (const fragmentOutputNode of this._fragmentOutputNodes) {
            fragmentNodes.push(fragmentOutputNode);
            this._initializeBlock(fragmentOutputNode, fragmentCompilationState, vertexNodes, autoConfigure);
        }

        // Optimize
        this.optimize();

        // Vertex
        for (const vertexOutputNode of vertexNodes) {
            vertexOutputNode.build(vertexCompilationState, vertexNodes);
        }

        // Fragment
        fragmentCompilationState.uniforms = vertexCompilationState.uniforms.slice(0);
        fragmentCompilationState._uniformDeclaration = vertexCompilationState._uniformDeclaration;
        fragmentCompilationState._constantDeclaration = vertexCompilationState._constantDeclaration;
        fragmentCompilationState._vertexState = vertexCompilationState;

        for (const fragmentOutputNode of fragmentNodes) {
            this._resetDualBlocks(fragmentOutputNode, this._buildId - 1);
        }

        for (const fragmentOutputNode of fragmentNodes) {
            fragmentOutputNode.build(fragmentCompilationState, fragmentNodes);
        }

        // Finalize
        vertexCompilationState.finalize(vertexCompilationState);
        fragmentCompilationState.finalize(fragmentCompilationState);

        if (updateBuildId) {
            this._buildId = NodeMaterial._BuildIdGenerator++;
        }

        // Errors
        this._sharedData.emitErrors();

        if (verbose) {
            Logger.Log("Vertex shader:");
            Logger.Log(vertexCompilationState.compilationString);
            Logger.Log("Fragment shader:");
            Logger.Log(fragmentCompilationState.compilationString);
        }

        this._buildWasSuccessful = true;
        this.onBuildObservable.notifyObservers(this);

        // Wipe defines
        const meshes = this.getScene().meshes;
        for (const mesh of meshes) {
            if (!mesh.subMeshes) {
                continue;
            }
            for (const subMesh of mesh.subMeshes) {
                if (subMesh.getMaterial() !== this) {
                    continue;
                }

                if (!subMesh.materialDefines) {
                    continue;
                }

                const defines = subMesh.materialDefines;
                defines.markAllAsDirty();
                defines.reset();
            }
        }

        if (this.prePassTextureInputs.length) {
            this.getScene().enablePrePassRenderer();
        }
        const prePassRenderer = this.getScene().prePassRenderer;
        if (prePassRenderer) {
            prePassRenderer.markAsDirty();
        }
    }

    /**
     * Runs an otpimization phase to try to improve the shader code
     */
    public optimize() {
        for (const optimizer of this._optimizers) {
            optimizer.optimize(this._vertexOutputNodes, this._fragmentOutputNodes);
        }
    }

    /**
     * Can this material render to prepass
     */
    public override get isPrePassCapable(): boolean {
        return true;
    }

    /**
     * Outputs written to the prepass
     */
    public get prePassTextureOutputs(): number[] {
        const prePassOutputBlock = this.getBlockByPredicate((block) => block.getClassName() === "PrePassOutputBlock") as PrePassOutputBlock;
        const result = [Constants.PREPASS_COLOR_TEXTURE_TYPE];
        if (!prePassOutputBlock) {
            return result;
        }
        // Cannot write to prepass if we alread read from prepass
        if (this.prePassTextureInputs.length) {
            return result;
        }

        if (prePassOutputBlock.viewDepth.isConnected) {
            result.push(Constants.PREPASS_DEPTH_TEXTURE_TYPE);
        }

        if (prePassOutputBlock.viewNormal.isConnected) {
            result.push(Constants.PREPASS_NORMAL_TEXTURE_TYPE);
        }

        if (prePassOutputBlock.worldPosition.isConnected) {
            result.push(Constants.PREPASS_POSITION_TEXTURE_TYPE);
        }

        return result;
    }

    /**
     * Gets the list of prepass texture required
     */
    public get prePassTextureInputs(): number[] {
        const prePassTextureBlocks = this.getAllTextureBlocks().filter((block) => block.getClassName() === "PrePassTextureBlock") as PrePassTextureBlock[];
        const result = [] as number[];

        for (const block of prePassTextureBlocks) {
            if (block.position.isConnected && !result.includes(Constants.PREPASS_POSITION_TEXTURE_TYPE)) {
                result.push(Constants.PREPASS_POSITION_TEXTURE_TYPE);
            }
            if (block.depth.isConnected && !result.includes(Constants.PREPASS_DEPTH_TEXTURE_TYPE)) {
                result.push(Constants.PREPASS_DEPTH_TEXTURE_TYPE);
            }
            if (block.normal.isConnected && !result.includes(Constants.PREPASS_NORMAL_TEXTURE_TYPE)) {
                result.push(Constants.PREPASS_NORMAL_TEXTURE_TYPE);
            }
        }

        return result;
    }

    /**
     * Sets the required values to the prepass renderer.
     * @param prePassRenderer defines the prepass renderer to set
     * @returns true if the pre pass is needed
     */
    public override setPrePassRenderer(prePassRenderer: PrePassRenderer): boolean {
        const prePassTexturesRequired = this.prePassTextureInputs.concat(this.prePassTextureOutputs);

        if (prePassRenderer && prePassTexturesRequired.length > 1) {
            let cfg = prePassRenderer.getEffectConfiguration("nodeMaterial");
            if (!cfg) {
                cfg = prePassRenderer.addEffectConfiguration({
                    enabled: true,
                    needsImageProcessing: false,
                    name: "nodeMaterial",
                    texturesRequired: [],
                });
            }
            for (const prePassTexture of prePassTexturesRequired) {
                if (!cfg.texturesRequired.includes(prePassTexture)) {
                    cfg.texturesRequired.push(prePassTexture);
                }
            }
            cfg.enabled = true;
        }

        // COLOR_TEXTURE is always required for prepass, length > 1 means
        // we actually need to write to special prepass textures
        return prePassTexturesRequired.length > 1;
    }

    /**
     * Create a post process from the material
     * @param camera The camera to apply the render pass to.
     * @param options The required width/height ratio to downsize to before computing the render pass. (Use 1.0 for full size)
     * @param samplingMode The sampling mode to be used when computing the pass. (default: 0)
     * @param engine The engine which the post process will be applied. (default: current engine)
     * @param reusable If the post process can be reused on the same frame. (default: false)
     * @param textureType Type of textures used when performing the post process. (default: 0)
     * @param textureFormat Format of textures used when performing the post process. (default: TEXTUREFORMAT_RGBA)
     * @returns the post process created
     */
    public createPostProcess(
        camera: Nullable<Camera>,
        options: number | PostProcessOptions = 1,
        samplingMode: number = Constants.TEXTURE_NEAREST_SAMPLINGMODE,
        engine?: AbstractEngine,
        reusable?: boolean,
        textureType: number = Constants.TEXTURETYPE_UNSIGNED_INT,
        textureFormat = Constants.TEXTUREFORMAT_RGBA
    ): Nullable<PostProcess> {
        if (this.mode !== NodeMaterialModes.PostProcess) {
            Logger.Log("Incompatible material mode");
            return null;
        }
        return this._createEffectForPostProcess(null, camera, options, samplingMode, engine, reusable, textureType, textureFormat);
    }

    /**
     * Create the post process effect from the material
     * @param postProcess The post process to create the effect for
     */
    public createEffectForPostProcess(postProcess: PostProcess) {
        this._createEffectForPostProcess(postProcess);
    }

    private _createEffectForPostProcess(
        postProcess: Nullable<PostProcess>,
        camera?: Nullable<Camera>,
        options: number | PostProcessOptions = 1,
        samplingMode: number = Constants.TEXTURE_NEAREST_SAMPLINGMODE,
        engine?: AbstractEngine,
        reusable?: boolean,
        textureType: number = Constants.TEXTURETYPE_UNSIGNED_INT,
        textureFormat = Constants.TEXTUREFORMAT_RGBA
    ): PostProcess {
        let tempName = this.name + this._buildId;

        const defines = new NodeMaterialDefines();

        const dummyMesh = new Mesh(tempName + "PostProcess", this.getScene());

        let buildId = this._buildId;

        this._processDefines(dummyMesh, defines);

        Effect.RegisterShader(tempName, this._fragmentCompilationState._builtCompilationString, this._vertexCompilationState._builtCompilationString, this.shaderLanguage);

        if (!postProcess) {
            postProcess = new PostProcess(
                this.name + "PostProcess",
                tempName,
                this._fragmentCompilationState.uniforms,
                this._fragmentCompilationState.samplers,
                options,
                camera!,
                samplingMode,
                engine,
                reusable,
                defines.toString(),
                textureType,
                tempName,
                { maxSimultaneousLights: this.maxSimultaneousLights },
                false,
                textureFormat,
                this.shaderLanguage
            );
        } else {
            postProcess.updateEffect(
                defines.toString(),
                this._fragmentCompilationState.uniforms,
                this._fragmentCompilationState.samplers,
                { maxSimultaneousLights: this.maxSimultaneousLights },
                undefined,
                undefined,
                tempName,
                tempName
            );
        }

        postProcess.nodeMaterialSource = this;

        postProcess.onApplyObservable.add((effect) => {
            if (buildId !== this._buildId) {
                delete Effect.ShadersStore[tempName + "VertexShader"];
                delete Effect.ShadersStore[tempName + "PixelShader"];

                tempName = this.name + this._buildId;

                defines.markAllAsDirty();

                buildId = this._buildId;
            }

            const result = this._processDefines(dummyMesh, defines);

            if (result) {
                Effect.RegisterShader(tempName, this._fragmentCompilationState._builtCompilationString, this._vertexCompilationState._builtCompilationString);

                TimingTools.SetImmediate(() =>
                    postProcess!.updateEffect(
                        defines.toString(),
                        this._fragmentCompilationState.uniforms,
                        this._fragmentCompilationState.samplers,
                        { maxSimultaneousLights: this.maxSimultaneousLights },
                        undefined,
                        undefined,
                        tempName,
                        tempName
                    )
                );
            }

            this._checkInternals(effect);
        });

        return postProcess;
    }

    /**
     * Create a new procedural texture based on this node material
     * @param size defines the size of the texture
     * @param scene defines the hosting scene
     * @returns the new procedural texture attached to this node material
     */
    public createProceduralTexture(size: number | { width: number; height: number; layers?: number }, scene: Scene): Nullable<ProceduralTexture> {
        if (this.mode !== NodeMaterialModes.ProceduralTexture) {
            Logger.Log("Incompatible material mode");
            return null;
        }

        let tempName = this.name + this._buildId;

        const proceduralTexture = new ProceduralTexture(tempName, size, null, scene);

        const dummyMesh = new Mesh(tempName + "Procedural", this.getScene());
        dummyMesh.reservedDataStore = {
            hidden: true,
        };

        const defines = new NodeMaterialDefines();
        const result = this._processDefines(dummyMesh, defines);
        Effect.RegisterShader(tempName, this._fragmentCompilationState._builtCompilationString, this._vertexCompilationState._builtCompilationString, this.shaderLanguage);

        let effect = this.getScene().getEngine().createEffect(
            {
                vertexElement: tempName,
                fragmentElement: tempName,
            },
            [VertexBuffer.PositionKind],
            this._fragmentCompilationState.uniforms,
            this._fragmentCompilationState.samplers,
            defines.toString(),
            result?.fallbacks,
            undefined,
            undefined,
            undefined,
            this.shaderLanguage
        );

        proceduralTexture.nodeMaterialSource = this;
        proceduralTexture._setEffect(effect);

        let buildId = this._buildId;
        proceduralTexture.onBeforeGenerationObservable.add(() => {
            if (buildId !== this._buildId) {
                delete Effect.ShadersStore[tempName + "VertexShader"];
                delete Effect.ShadersStore[tempName + "PixelShader"];

                tempName = this.name + this._buildId;

                defines.markAllAsDirty();

                buildId = this._buildId;
            }

            const result = this._processDefines(dummyMesh, defines);

            if (result) {
                Effect.RegisterShader(tempName, this._fragmentCompilationState._builtCompilationString, this._vertexCompilationState._builtCompilationString, this.shaderLanguage);

                TimingTools.SetImmediate(() => {
                    effect = this.getScene().getEngine().createEffect(
                        {
                            vertexElement: tempName,
                            fragmentElement: tempName,
                        },
                        [VertexBuffer.PositionKind],
                        this._fragmentCompilationState.uniforms,
                        this._fragmentCompilationState.samplers,
                        defines.toString(),
                        result?.fallbacks,
                        undefined
                    );

                    proceduralTexture._setEffect(effect);
                });
            }

            this._checkInternals(effect);
        });

        return proceduralTexture;
    }

    private _createEffectForParticles(
        particleSystem: IParticleSystem,
        blendMode: number,
        onCompiled?: (effect: Effect) => void,
        onError?: (effect: Effect, errors: string) => void,
        effect?: Effect,
        defines?: NodeMaterialDefines,
        dummyMesh?: Nullable<AbstractMesh>,
        particleSystemDefinesJoined = ""
    ) {
        let tempName = this.name + this._buildId + "_" + blendMode;

        if (!defines) {
            defines = new NodeMaterialDefines();
        }

        if (!dummyMesh) {
            dummyMesh = this.getScene().getMeshByName(this.name + "Particle");
            if (!dummyMesh) {
                dummyMesh = new Mesh(this.name + "Particle", this.getScene());
                dummyMesh.reservedDataStore = {
                    hidden: true,
                };
            }
        }

        let buildId = this._buildId;

        const particleSystemDefines: Array<string> = [];
        let join = particleSystemDefinesJoined;

        if (!effect) {
            const result = this._processDefines(dummyMesh, defines);

            Effect.RegisterShader(tempName, this._fragmentCompilationState._builtCompilationString, undefined, this.shaderLanguage);

            particleSystem.fillDefines(particleSystemDefines, blendMode, false);

            join = particleSystemDefines.join("\n");

            effect = this.getScene()
                .getEngine()
                .createEffectForParticles(
                    tempName,
                    this._fragmentCompilationState.uniforms,
                    this._fragmentCompilationState.samplers,
                    defines.toString() + "\n" + join,
                    result?.fallbacks,
                    onCompiled,
                    onError,
                    particleSystem,
                    this.shaderLanguage
                );

            particleSystem.setCustomEffect(effect, blendMode);
        }

        effect.onBindObservable.add((effect) => {
            if (buildId !== this._buildId) {
                delete Effect.ShadersStore[tempName + "PixelShader"];

                tempName = this.name + this._buildId + "_" + blendMode;

                defines!.markAllAsDirty();

                buildId = this._buildId;
            }

            particleSystemDefines.length = 0;

            particleSystem.fillDefines(particleSystemDefines, blendMode, false);

            const particleSystemDefinesJoinedCurrent = particleSystemDefines.join("\n");

            if (particleSystemDefinesJoinedCurrent !== join) {
                defines!.markAllAsDirty();
                join = particleSystemDefinesJoinedCurrent;
            }

            const result = this._processDefines(dummyMesh!, defines!);

            if (result) {
                Effect.RegisterShader(tempName, this._fragmentCompilationState._builtCompilationString, undefined, this.shaderLanguage);

                effect = this.getScene()
                    .getEngine()
                    .createEffectForParticles(
                        tempName,
                        this._fragmentCompilationState.uniforms,
                        this._fragmentCompilationState.samplers,
                        defines!.toString() + "\n" + join,
                        result?.fallbacks,
                        onCompiled,
                        onError,
                        particleSystem
                    );
                particleSystem.setCustomEffect(effect, blendMode);
                this._createEffectForParticles(particleSystem, blendMode, onCompiled, onError, effect, defines, dummyMesh, particleSystemDefinesJoined); // add the effect.onBindObservable observer
                return;
            }

            this._checkInternals(effect);
        });
    }

    private _checkInternals(effect: Effect) {
        // Animated blocks
        if (this._sharedData.animatedInputs) {
            const scene = this.getScene();

            const frameId = scene.getFrameId();

            if (this._animationFrame !== frameId) {
                for (const input of this._sharedData.animatedInputs) {
                    input.animate(scene);
                }

                this._animationFrame = frameId;
            }
        }

        // Bindable blocks
        for (const block of this._sharedData.bindableBlocks) {
            block.bind(effect, this);
        }

        // Connection points
        for (const inputBlock of this._sharedData.inputBlocks) {
            inputBlock._transmit(effect, this.getScene(), this);
        }
    }

    /**
     * Create the effect to be used as the custom effect for a particle system
     * @param particleSystem Particle system to create the effect for
     * @param onCompiled defines a function to call when the effect creation is successful
     * @param onError defines a function to call when the effect creation has failed
     */
    public createEffectForParticles(particleSystem: IParticleSystem, onCompiled?: (effect: Effect) => void, onError?: (effect: Effect, errors: string) => void) {
        if (this.mode !== NodeMaterialModes.Particle) {
            Logger.Log("Incompatible material mode");
            return;
        }

        this._createEffectForParticles(particleSystem, BaseParticleSystem.BLENDMODE_ONEONE, onCompiled, onError);
        this._createEffectForParticles(particleSystem, BaseParticleSystem.BLENDMODE_MULTIPLY, onCompiled, onError);
    }

    /**
     * Use this material as the shadow depth wrapper of a target material
     * @param targetMaterial defines the target material
     */
    public createAsShadowDepthWrapper(targetMaterial: Material) {
        if (this.mode !== NodeMaterialModes.Material) {
            Logger.Log("Incompatible material mode");
            return;
        }

        targetMaterial.shadowDepthWrapper = new BABYLON.ShadowDepthWrapper(this, this.getScene());
    }

    /**
     * Get if the submesh is ready to be used and all its information available.
     * Child classes can use it to update shaders
     * @param mesh defines the mesh to check
     * @param subMesh defines which submesh to check
     * @param useInstances specifies that instances should be used
     * @returns a boolean indicating that the submesh is ready or not
     */
    public override isReadyForSubMesh(mesh: AbstractMesh, subMesh: SubMesh, useInstances: boolean = false): boolean {
        if (!this._buildWasSuccessful) {
            return false;
        }
        const scene = this.getScene();

        // Animations
        if (this._sharedData.animatedInputs) {
            const frameId = scene.getFrameId();

            if (this._animationFrame !== frameId) {
                for (const input of this._sharedData.animatedInputs) {
                    input.animate(scene);
                }

                this._animationFrame = frameId;
            }
        }

        return super.isReadyForSubMesh(mesh, subMesh, useInstances);
    }

    /**
     * Get a string representing the shaders built by the current node graph
     */
    public get compiledShaders() {
        return `// Vertex shader\n${this._vertexCompilationState.compilationString}\n\n// Fragment shader\n${this._fragmentCompilationState.compilationString}`;
    }

    /**
     * Gets the active textures from the material
     * @returns an array of textures
     */
    public override getActiveTextures(): BaseTexture[] {
        const activeTextures = super.getActiveTextures();

        if (this._sharedData) {
            activeTextures.push(...this._sharedData.textureBlocks.filter((tb) => tb.texture).map((tb) => tb.texture!));
        }

        return activeTextures;
    }

    /**
     * Gets the list of texture blocks
     * Note that this method will only return blocks that are reachable from the final block(s) and only after the material has been built!
     * @returns an array of texture blocks
     */
    public getTextureBlocks(): NodeMaterialTextureBlocks[] {
        if (!this._sharedData) {
            return [];
        }

        return this._sharedData.textureBlocks;
    }

    /**
     * Gets the list of all texture blocks
     * Note that this method will scan all attachedBlocks and return blocks that are texture blocks
     * @returns
     */
    public getAllTextureBlocks(): NodeMaterialTextureBlocks[] {
        const textureBlocks: NodeMaterialTextureBlocks[] = [];

        for (const block of this.attachedBlocks) {
            if (NodeMaterial._BlockIsTextureBlock(block)) {
                textureBlocks.push(block);
            }
        }

        return textureBlocks;
    }

    /**
     * Specifies if the material uses a texture
     * @param texture defines the texture to check against the material
     * @returns a boolean specifying if the material uses the texture
     */
    public override hasTexture(texture: BaseTexture): boolean {
        if (super.hasTexture(texture)) {
            return true;
        }

        if (!this._sharedData) {
            return false;
        }

        for (const t of this._sharedData.textureBlocks) {
            if (t.texture === texture) {
                return true;
            }
        }

        return false;
    }

    /**
     * Disposes the material
     * @param forceDisposeEffect specifies if effects should be forcefully disposed
     * @param forceDisposeTextures specifies if textures should be forcefully disposed
     * @param notBoundToMesh specifies if the material that is being disposed is known to be not bound to any mesh
     */
    public override dispose(forceDisposeEffect?: boolean, forceDisposeTextures?: boolean, notBoundToMesh?: boolean): void {
        if (forceDisposeTextures) {
            for (const texture of this.getTextureBlocks()
                .filter((tb) => tb.texture)
                .map((tb) => tb.texture!)) {
                texture.dispose();
            }
        }

        for (const block of this.attachedBlocks) {
            block.dispose();
        }

        this.attachedBlocks.length = 0;
        (this._sharedData as any) = null;
        (this._vertexCompilationState as any) = null;
        (this._fragmentCompilationState as any) = null;

        this.onBuildObservable.clear();

        if (this._imageProcessingObserver) {
            this._imageProcessingConfiguration.onUpdateParameters.remove(this._imageProcessingObserver);
            this._imageProcessingObserver = null;
        }

        super.dispose(forceDisposeEffect, forceDisposeTextures, notBoundToMesh);
    }

    /** Creates the node editor window.
     * @param additionalConfig Define the configuration of the editor
     */
    private _createNodeEditor(additionalConfig?: any) {
        const nodeEditorConfig: any = {
            nodeMaterial: this,
            ...additionalConfig,
        };
        this.BJSNODEMATERIALEDITOR.NodeEditor.Show(nodeEditorConfig);
    }

    /**
     * Launch the node material editor
     * @param config Define the configuration of the editor
     * @returns a promise fulfilled when the node editor is visible
     */
    public edit(config?: INodeMaterialEditorOptions): Promise<void> {
        return new Promise((resolve) => {
            this.BJSNODEMATERIALEDITOR = this.BJSNODEMATERIALEDITOR || this._getGlobalNodeMaterialEditor();
            if (typeof this.BJSNODEMATERIALEDITOR == "undefined") {
                const editorUrl = config && config.editorURL ? config.editorURL : NodeMaterial.EditorURL;

                // Load editor and add it to the DOM
                Tools.LoadBabylonScript(editorUrl, () => {
                    this.BJSNODEMATERIALEDITOR = this.BJSNODEMATERIALEDITOR || this._getGlobalNodeMaterialEditor();
                    this._createNodeEditor(config?.nodeEditorConfig);
                    resolve();
                });
            } else {
                // Otherwise creates the editor
                this._createNodeEditor(config?.nodeEditorConfig);
                resolve();
            }
        });
    }

    /**
     * Clear the current material
     */
    public clear() {
        this._vertexOutputNodes.length = 0;
        this._fragmentOutputNodes.length = 0;
        this.attachedBlocks.length = 0;
    }

    /**
     * Clear the current material and set it to a default state
     */
    public setToDefault() {
        this.clear();

        this.editorData = null;

        const positionInput = new InputBlock("Position");
        positionInput.setAsAttribute("position");

        const worldInput = new InputBlock("World");
        worldInput.setAsSystemValue(NodeMaterialSystemValues.World);

        const worldPos = new TransformBlock("WorldPos");
        positionInput.connectTo(worldPos);
        worldInput.connectTo(worldPos);

        const viewProjectionInput = new InputBlock("ViewProjection");
        viewProjectionInput.setAsSystemValue(NodeMaterialSystemValues.ViewProjection);

        const worldPosdMultipliedByViewProjection = new TransformBlock("WorldPos * ViewProjectionTransform");
        worldPos.connectTo(worldPosdMultipliedByViewProjection);
        viewProjectionInput.connectTo(worldPosdMultipliedByViewProjection);

        const vertexOutput = new VertexOutputBlock("VertexOutput");
        worldPosdMultipliedByViewProjection.connectTo(vertexOutput);

        // Pixel
        const pixelColor = new InputBlock("color");
        pixelColor.value = new Color4(0.8, 0.8, 0.8, 1);

        const fragmentOutput = new FragmentOutputBlock("FragmentOutput");
        pixelColor.connectTo(fragmentOutput);

        // Add to nodes
        this.addOutputNode(vertexOutput);
        this.addOutputNode(fragmentOutput);

        this._mode = NodeMaterialModes.Material;
    }

    /**
     * Clear the current material and set it to a default state for post process
     */
    public setToDefaultPostProcess() {
        this.clear();

        this.editorData = null;

        const position = new InputBlock("Position");
        position.setAsAttribute("position2d");

        const const1 = new InputBlock("Constant1");
        const1.isConstant = true;
        const1.value = 1;

        const vmerger = new VectorMergerBlock("Position3D");

        position.connectTo(vmerger);
        const1.connectTo(vmerger, { input: "w" });

        const vertexOutput = new VertexOutputBlock("VertexOutput");
        vmerger.connectTo(vertexOutput);

        // Pixel
        const scale = new InputBlock("Scale");
        scale.visibleInInspector = true;
        scale.value = new Vector2(1, 1);

        const uv0 = new RemapBlock("uv0");
        position.connectTo(uv0);

        const uv = new MultiplyBlock("UV scale");
        uv0.connectTo(uv);
        scale.connectTo(uv);

        const currentScreen = new CurrentScreenBlock("CurrentScreen");
        uv.connectTo(currentScreen);

        currentScreen.texture = new Texture("https://assets.babylonjs.com/nme/currentScreenPostProcess.png", this.getScene());

        const fragmentOutput = new FragmentOutputBlock("FragmentOutput");
        currentScreen.connectTo(fragmentOutput, { output: "rgba" });

        // Add to nodes
        this.addOutputNode(vertexOutput);
        this.addOutputNode(fragmentOutput);

        this._mode = NodeMaterialModes.PostProcess;
    }

    /**
     * Clear the current material and set it to a default state for procedural texture
     */
    public setToDefaultProceduralTexture() {
        this.clear();

        this.editorData = null;

        const position = new InputBlock("Position");
        position.setAsAttribute("position2d");

        const const1 = new InputBlock("Constant1");
        const1.isConstant = true;
        const1.value = 1;

        const vmerger = new VectorMergerBlock("Position3D");

        position.connectTo(vmerger);
        const1.connectTo(vmerger, { input: "w" });

        const vertexOutput = new VertexOutputBlock("VertexOutput");
        vmerger.connectTo(vertexOutput);

        // Pixel
        const time = new InputBlock("Time");
        time.value = 0;
        time.min = 0;
        time.max = 0;
        time.isBoolean = false;
        time.matrixMode = 0;
        time.animationType = AnimatedInputBlockTypes.Time;
        time.isConstant = false;

        const color = new InputBlock("Color3");
        color.value = new Color3(1, 1, 1);
        color.isConstant = false;
        const fragmentOutput = new FragmentOutputBlock("FragmentOutput");

        const vectorMerger = new VectorMergerBlock("VectorMerger");
        vectorMerger.visibleInInspector = false;

        const cos = new TrigonometryBlock("Cos");
        cos.operation = TrigonometryBlockOperations.Cos;

        position.connectTo(vectorMerger);
        time.output.connectTo(cos.input);
        cos.output.connectTo(vectorMerger.z);
        vectorMerger.xyzOut.connectTo(fragmentOutput.rgb);

        // Add to nodes
        this.addOutputNode(vertexOutput);
        this.addOutputNode(fragmentOutput);

        this._mode = NodeMaterialModes.ProceduralTexture;
    }

    /**
     * Clear the current material and set it to a default state for particle
     */
    public setToDefaultParticle() {
        this.clear();

        this.editorData = null;

        // Pixel
        const uv = new InputBlock("uv");
        uv.setAsAttribute("particle_uv");

        const texture = new ParticleTextureBlock("ParticleTexture");
        uv.connectTo(texture);

        const color = new InputBlock("Color");
        color.setAsAttribute("particle_color");

        const multiply = new MultiplyBlock("Texture * Color");
        texture.connectTo(multiply);
        color.connectTo(multiply);

        const rampGradient = new ParticleRampGradientBlock("ParticleRampGradient");
        multiply.connectTo(rampGradient);

        const cSplitter = new ColorSplitterBlock("ColorSplitter");
        color.connectTo(cSplitter);

        const blendMultiply = new ParticleBlendMultiplyBlock("ParticleBlendMultiply");
        rampGradient.connectTo(blendMultiply);
        texture.connectTo(blendMultiply, { output: "a" });
        cSplitter.connectTo(blendMultiply, { output: "a" });

        const fragmentOutput = new FragmentOutputBlock("FragmentOutput");
        blendMultiply.connectTo(fragmentOutput);

        // Add to nodes
        this.addOutputNode(fragmentOutput);

        this._mode = NodeMaterialModes.Particle;
    }

    /**
     * Loads the current Node Material from a url pointing to a file save by the Node Material Editor
     * @deprecated Please use NodeMaterial.ParseFromFileAsync instead
     * @param url defines the url to load from
     * @param rootUrl defines the root URL for nested url in the node material
     * @returns a promise that will fulfil when the material is fully loaded
     */
    public async loadAsync(url: string, rootUrl: string = "") {
        return NodeMaterial.ParseFromFileAsync("", url, this.getScene(), rootUrl, true, this);
    }

    private _gatherBlocks(rootNode: NodeMaterialBlock, list: NodeMaterialBlock[]) {
        if (list.indexOf(rootNode) !== -1) {
            return;
        }
        list.push(rootNode);

        for (const input of rootNode.inputs) {
            const connectedPoint = input.connectedPoint;
            if (connectedPoint) {
                const block = connectedPoint.ownerBlock;
                if (block !== rootNode) {
                    this._gatherBlocks(block, list);
                }
            }
        }

        // Teleportation
        if (rootNode.isTeleportOut) {
            const block = rootNode as NodeMaterialTeleportOutBlock;
            if (block.entryPoint) {
                this._gatherBlocks(block.entryPoint, list);
            }
        }
    }

    /**
     * Generate a string containing the code declaration required to create an equivalent of this material
     * @returns a string
     */
    public generateCode() {
        let alreadyDumped: NodeMaterialBlock[] = [];
        const vertexBlocks: NodeMaterialBlock[] = [];
        const uniqueNames: string[] = ["const", "var", "let"];
        // Gets active blocks
        for (const outputNode of this._vertexOutputNodes) {
            this._gatherBlocks(outputNode, vertexBlocks);
        }

        const fragmentBlocks: NodeMaterialBlock[] = [];
        for (const outputNode of this._fragmentOutputNodes) {
            this._gatherBlocks(outputNode, fragmentBlocks);
        }

        // Generate vertex shader
        let codeString = `var nodeMaterial = new BABYLON.NodeMaterial("${this.name || "node material"}");\n`;
        codeString += `nodeMaterial.mode = BABYLON.NodeMaterialModes.${NodeMaterialModes[this.mode]};\n`;
        for (const node of vertexBlocks) {
            if (node.isInput && alreadyDumped.indexOf(node) === -1) {
                codeString += node._dumpCode(uniqueNames, alreadyDumped);
            }
        }

        // Generate fragment shader
        for (const node of fragmentBlocks) {
            if (node.isInput && alreadyDumped.indexOf(node) === -1) {
                codeString += node._dumpCode(uniqueNames, alreadyDumped);
            }
        }

        // Connections
        alreadyDumped = [];
        codeString += "\n// Connections\n";
        for (const node of this._vertexOutputNodes) {
            codeString += node._dumpCodeForOutputConnections(alreadyDumped);
        }
        for (const node of this._fragmentOutputNodes) {
            codeString += node._dumpCodeForOutputConnections(alreadyDumped);
        }

        // Output nodes
        codeString += "\n// Output nodes\n";
        for (const node of this._vertexOutputNodes) {
            codeString += `nodeMaterial.addOutputNode(${node._codeVariableName});\n`;
        }

        for (const node of this._fragmentOutputNodes) {
            codeString += `nodeMaterial.addOutputNode(${node._codeVariableName});\n`;
        }

        codeString += `nodeMaterial.build();\n`;

        return codeString;
    }

    /**
     * Serializes this material in a JSON representation
     * @param selectedBlocks defines an optional list of blocks to serialize
     * @returns the serialized material object
     */
    public override serialize(selectedBlocks?: NodeMaterialBlock[]): any {
        const serializationObject = selectedBlocks ? {} : SerializationHelper.Serialize(this);
        serializationObject.editorData = JSON.parse(JSON.stringify(this.editorData)); // Copy

        let blocks: NodeMaterialBlock[] = [];

        if (selectedBlocks) {
            blocks = selectedBlocks;
        } else {
            serializationObject.customType = "BABYLON.NodeMaterial";
            serializationObject.outputNodes = [];

            // Outputs
            for (const outputNode of this._vertexOutputNodes) {
                this._gatherBlocks(outputNode, blocks);
                serializationObject.outputNodes.push(outputNode.uniqueId);
            }

            for (const outputNode of this._fragmentOutputNodes) {
                this._gatherBlocks(outputNode, blocks);

                if (serializationObject.outputNodes.indexOf(outputNode.uniqueId) === -1) {
                    serializationObject.outputNodes.push(outputNode.uniqueId);
                }
            }
        }

        // Blocks
        serializationObject.blocks = [];

        for (const block of blocks) {
            serializationObject.blocks.push(block.serialize());
        }

        if (!selectedBlocks) {
            for (const block of this.attachedBlocks) {
                if (blocks.indexOf(block) !== -1) {
                    continue;
                }
                serializationObject.blocks.push(block.serialize());
            }
        }

        serializationObject.uniqueId = this.uniqueId;

        return serializationObject;
    }

    private _restoreConnections(block: NodeMaterialBlock, source: any, map: { [key: number]: NodeMaterialBlock }) {
        for (const outputPoint of block.outputs) {
            for (const candidate of source.blocks) {
                const target = map[candidate.id];

                if (!target) {
                    continue;
                }

                for (const input of candidate.inputs) {
                    if (map[input.targetBlockId] === block && input.targetConnectionName === outputPoint.name) {
                        const inputPoint = target.getInputByName(input.inputName);
                        if (!inputPoint || inputPoint.isConnected) {
                            continue;
                        }

                        outputPoint.connectTo(inputPoint, true);
                        this._restoreConnections(target, source, map);
                        continue;
                    }
                }
            }
        }
    }

    /**
     * Clear the current graph and load a new one from a serialization object
     * @param source defines the JSON representation of the material
     * @param rootUrl defines the root URL to use to load textures and relative dependencies
     * @param merge defines whether or not the source must be merged or replace the current content
     * @param urlRewriter defines a function used to rewrite urls
     */
    public parseSerializedObject(source: any, rootUrl: string = "", merge = false, urlRewriter?: (url: string) => string) {
        if (!merge) {
            this.clear();
        }

        const map: { [key: number]: NodeMaterialBlock } = {};

        // Create blocks
        for (const parsedBlock of source.blocks) {
            const blockType = GetClass(parsedBlock.customType);
            if (blockType) {
                const block: NodeMaterialBlock = new blockType();
                block._deserialize(parsedBlock, this.getScene(), rootUrl, urlRewriter);
                map[parsedBlock.id] = block;

                this.attachedBlocks.push(block);
            }
        }

        // Reconnect teleportation
        for (const block of this.attachedBlocks) {
            if (block.isTeleportOut) {
                const teleportOut = block as NodeMaterialTeleportOutBlock;
                const id = teleportOut._tempEntryPointUniqueId;
                if (id) {
                    const source = map[id] as NodeMaterialTeleportInBlock;
                    source.attachToEndpoint(teleportOut);
                }
            }
        }

        // Connections - Starts with input blocks only (except if in "merge" mode where we scan all blocks)
        for (let blockIndex = 0; blockIndex < source.blocks.length; blockIndex++) {
            const parsedBlock = source.blocks[blockIndex];
            const block = map[parsedBlock.id];

            if (!block) {
                continue;
            }

            if (block.inputs.length && !merge) {
                continue;
            }
            this._restoreConnections(block, source, map);
        }

        // Outputs
        if (source.outputNodes) {
            for (const outputNodeId of source.outputNodes) {
                this.addOutputNode(map[outputNodeId]);
            }
        }

        // UI related info
        if (source.locations || (source.editorData && source.editorData.locations)) {
            const locations: {
                blockId: number;
                x: number;
                y: number;
            }[] = source.locations || source.editorData.locations;

            for (const location of locations) {
                if (map[location.blockId]) {
                    location.blockId = map[location.blockId].uniqueId;
                }
            }

            if (merge && this.editorData && this.editorData.locations) {
                locations.concat(this.editorData.locations);
            }

            if (source.locations) {
                this.editorData = {
                    locations: locations,
                };
            } else {
                this.editorData = source.editorData;
                this.editorData.locations = locations;
            }

            const blockMap: number[] = [];

            for (const key in map) {
                blockMap[key] = map[key].uniqueId;
            }

            this.editorData.map = blockMap;
        }

        this.comment = source.comment;

        if (source.forceAlphaBlending !== undefined) {
            this.forceAlphaBlending = source.forceAlphaBlending;
        }

        if (source.alphaMode !== undefined) {
            this.alphaMode = source.alphaMode;
        }

        if (!merge) {
            this._mode = source.mode ?? NodeMaterialModes.Material;
        }
    }

    /**
     * Clear the current graph and load a new one from a serialization object
     * @param source defines the JSON representation of the material
     * @param rootUrl defines the root URL to use to load textures and relative dependencies
     * @param merge defines whether or not the source must be merged or replace the current content
     * @deprecated Please use the parseSerializedObject method instead
     */
    public loadFromSerialization(source: any, rootUrl: string = "", merge = false) {
        this.parseSerializedObject(source, rootUrl, merge);
    }

    /**
     * Makes a duplicate of the current material.
     * @param name defines the name to use for the new material
     * @param shareEffect defines if the clone material should share the same effect (default is false)
     * @returns the cloned material
     */
    public override clone(name: string, shareEffect: boolean = false): NodeMaterial {
        const serializationObject = this.serialize();

        const clone = SerializationHelper.Clone(() => new NodeMaterial(name, this.getScene(), this.options), this);
        clone.id = name;
        clone.name = name;

        clone.parseSerializedObject(serializationObject);
        clone._buildId = this._buildId;
        clone.build(false, !shareEffect);

        return clone;
    }

    /**
     * Awaits for all the material textures to be ready before resolving the returned promise.
     * @returns A promise that resolves when the textures are ready.
     */
    public whenTexturesReadyAsync(): Promise<void[]> {
        // Ensures all textures are ready to render.
        const textureReadyPromises: Promise<void>[] = [];
        this.getActiveTextures().forEach((texture) => {
            const internalTexture = texture.getInternalTexture();
            if (internalTexture && !internalTexture.isReady) {
                textureReadyPromises.push(
                    new Promise((textureResolve, textureReject) => {
                        internalTexture.onLoadedObservable.addOnce(() => {
                            textureResolve();
                        });
                        internalTexture.onErrorObservable.addOnce((e) => {
                            textureReject(e);
                        });
                    })
                );
            }
        });

        return Promise.all(textureReadyPromises);
    }

    /**
     * Creates a node material from parsed material data
     * @param source defines the JSON representation of the material
     * @param scene defines the hosting scene
     * @param rootUrl defines the root URL to use to load textures and relative dependencies
     * @param shaderLanguage defines the language to use (GLSL by default)
     * @returns a new node material
     */
    public static override Parse(source: any, scene: Scene, rootUrl: string = "", shaderLanguage = ShaderLanguage.GLSL): NodeMaterial {
        const nodeMaterial = SerializationHelper.Parse(() => new NodeMaterial(source.name, scene, { shaderLanguage: shaderLanguage }), source, scene, rootUrl);

        nodeMaterial.parseSerializedObject(source, rootUrl);
        nodeMaterial.build();

        return nodeMaterial;
    }

    /**
     * Creates a node material from a snippet saved in a remote file
     * @param name defines the name of the material to create
     * @param url defines the url to load from
     * @param scene defines the hosting scene
     * @param rootUrl defines the root URL for nested url in the node material
     * @param skipBuild defines whether to build the node material
     * @param targetMaterial defines a material to use instead of creating a new one
     * @param urlRewriter defines a function used to rewrite urls
     * @returns a promise that will resolve to the new node material
     */
    public static async ParseFromFileAsync(
        name: string,
        url: string,
        scene: Scene,
        rootUrl: string = "",
        skipBuild: boolean = false,
        targetMaterial?: NodeMaterial,
        urlRewriter?: (url: string) => string
    ): Promise<NodeMaterial> {
        const material = targetMaterial ?? new NodeMaterial(name, scene);

        const data = await scene._loadFileAsync(url);
        const serializationObject = JSON.parse(data);
        material.parseSerializedObject(serializationObject, rootUrl, undefined, urlRewriter);
        if (!skipBuild) {
            material.build();
        }
        return material;
    }

    /**
     * Creates a node material from a snippet saved by the node material editor
     * @param snippetId defines the snippet to load
     * @param scene defines the hosting scene
     * @param rootUrl defines the root URL to use to load textures and relative dependencies
     * @param nodeMaterial defines a node material to update (instead of creating a new one)
     * @param skipBuild defines whether to build the node material
     * @param waitForTextureReadyness defines whether to wait for texture readiness resolving the promise (default: false)
     * @param urlRewriter defines a function used to rewrite urls
     * @returns a promise that will resolve to the new node material
     */
    public static ParseFromSnippetAsync(
        snippetId: string,
        scene: Scene = EngineStore.LastCreatedScene!,
        rootUrl: string = "",
        nodeMaterial?: NodeMaterial,
        skipBuild: boolean = false,
        waitForTextureReadyness: boolean = false,
        urlRewriter?: (url: string) => string
    ): Promise<NodeMaterial> {
        if (snippetId === "_BLANK") {
            return Promise.resolve(NodeMaterial.CreateDefault("blank", scene));
        }

        return new Promise((resolve, reject) => {
            const request = new WebRequest();
            request.addEventListener("readystatechange", () => {
                if (request.readyState == 4) {
                    if (request.status == 200) {
                        const snippet = JSON.parse(JSON.parse(request.responseText).jsonPayload);
                        const serializationObject = JSON.parse(snippet.nodeMaterial);

                        if (!nodeMaterial) {
                            nodeMaterial = SerializationHelper.Parse(() => new NodeMaterial(snippetId, scene), serializationObject, scene, rootUrl);
                            nodeMaterial.uniqueId = scene.getUniqueId();
                        }

                        nodeMaterial.parseSerializedObject(serializationObject, undefined, undefined, urlRewriter);
                        nodeMaterial.snippetId = snippetId;

                        // We reset sideOrientation to default value
                        nodeMaterial.sideOrientation = null;

                        try {
                            if (!skipBuild) {
                                nodeMaterial.build();
                            }
                        } catch (err) {
                            reject(err);
                        }

                        if (waitForTextureReadyness) {
                            nodeMaterial
                                .whenTexturesReadyAsync()
                                .then(() => {
                                    resolve(nodeMaterial!);
                                })
                                .catch((err) => {
                                    reject(err);
                                });
                        } else {
                            resolve(nodeMaterial);
                        }
                    } else {
                        reject("Unable to load the snippet " + snippetId);
                    }
                }
            });

            request.open("GET", this.SnippetUrl + "/" + snippetId.replace(/#/g, "/"));
            request.send();
        });
    }

    /**
     * Creates a new node material set to default basic configuration
     * @param name defines the name of the material
     * @param scene defines the hosting scene
     * @returns a new NodeMaterial
     */
    public static CreateDefault(name: string, scene?: Scene) {
        const newMaterial = new NodeMaterial(name, scene);

        newMaterial.setToDefault();
        newMaterial.build();

        return newMaterial;
    }
}

RegisterClass("BABYLON.NodeMaterial", NodeMaterial);
