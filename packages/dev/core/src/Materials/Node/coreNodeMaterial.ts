/* eslint-disable @typescript-eslint/naming-convention */
import type { AbstractMesh } from "core/Meshes/abstractMesh";
import type { IImageProcessingConfigurationDefines } from "../imageProcessingConfiguration.defines";
import { MaterialDefines } from "../materialDefines";
import { PushMaterial } from "../pushMaterial";
import type { SubMesh } from "core/Meshes/subMesh";
import { VertexBuffer } from "core/Meshes/buffer";
import { Constants } from "core/Engines/constants";
import { PrepareDefinesForPrePass, PrepareDefinesForCamera } from "../materialHelper.functions";
import type { Effect, IEffectCreationOptions } from "../effect";
import type { Nullable } from "core/types";
import { Matrix } from "core/Maths/math.vector";
import type { Mesh } from "core/Meshes/mesh";
import { EffectFallbacks } from "../effectFallbacks";
import { EngineStore } from "core/Engines/engineStore";
import type { Scene } from "core/scene";
import { ShaderLanguage } from "../shaderLanguage";
import type { CoreNodeMaterialBuildState } from "./coreNodeMaterialBuildState";

/**
 * Class used to configure NodeMaterial
 */
export interface INodeMaterialOptions {
    /** Defines shader language to use (default to GLSL) */
    shaderLanguage: ShaderLanguage;
}

/** @internal */
export class NodeMaterialDefines extends MaterialDefines implements IImageProcessingConfigurationDefines {
    /** Normal */
    public NORMAL = false;
    /** Tangent */
    public TANGENT = false;
    /** Vertex color */
    public VERTEXCOLOR_NME = false;
    /**  Uv1 **/
    public UV1 = false;
    /** Uv2 **/
    public UV2 = false;
    /** Uv3 **/
    public UV3 = false;
    /** Uv4 **/
    public UV4 = false;
    /** Uv5 **/
    public UV5 = false;
    /** Uv6 **/
    public UV6 = false;

    /** Prepass **/
    public PREPASS = false;
    /** Prepass normal */
    public PREPASS_NORMAL = false;
    /** Prepass normal index */
    public PREPASS_NORMAL_INDEX = -1;
    /** Prepass position */
    public PREPASS_POSITION = false;
    /** Prepass position index */
    public PREPASS_POSITION_INDEX = -1;
    /** Prepass depth */
    public PREPASS_DEPTH = false;
    /** Prepass depth index */
    public PREPASS_DEPTH_INDEX = -1;
    /** Scene MRT count */
    public SCENE_MRT_COUNT = 0;

    /** BONES */
    public NUM_BONE_INFLUENCERS = 0;
    /** Bones per mesh */
    public BonesPerMesh = 0;
    /** Using texture for bone storage */
    public BONETEXTURE = false;

    /** MORPH TARGETS */
    public MORPHTARGETS = false;
    /** Morph target normal */
    public MORPHTARGETS_NORMAL = false;
    /** Morph target tangent */
    public MORPHTARGETS_TANGENT = false;
    /** Morph target uv */
    public MORPHTARGETS_UV = false;
    /** Number of morph influencers */
    public NUM_MORPH_INFLUENCERS = 0;
    /** Using a texture to store morph target data */
    public MORPHTARGETS_TEXTURE = false;

    /** IMAGE PROCESSING */
    public IMAGEPROCESSING = false;
    /** Vignette */
    public VIGNETTE = false;
    /** Multiply blend mode for vignette */
    public VIGNETTEBLENDMODEMULTIPLY = false;
    /** Opaque blend mode for vignette */
    public VIGNETTEBLENDMODEOPAQUE = false;
    /** Tone mapping */
    public TONEMAPPING = 0;
    /** Contrast */
    public CONTRAST = false;
    /** Exposure */
    public EXPOSURE = false;
    /** Color curves */
    public COLORCURVES = false;
    /** Color grading */
    public COLORGRADING = false;
    /** 3D color grading */
    public COLORGRADING3D = false;
    /** Sampler green depth */
    public SAMPLER3DGREENDEPTH = false;
    /** Sampler for BGR map */
    public SAMPLER3DBGRMAP = false;
    /** Dithering */
    public DITHER = false;
    /** Using post process for image processing */
    public IMAGEPROCESSINGPOSTPROCESS = false;
    /** Skip color clamp */
    public SKIPFINALCOLORCLAMP = false;

    /** MISC. */
    public BUMPDIRECTUV = 0;
    /** Camera is orthographic */
    public CAMERA_ORTHOGRAPHIC = false;
    /** Camera is perspective */
    public CAMERA_PERSPECTIVE = false;

    /**
     * Creates a new NodeMaterialDefines
     */
    constructor() {
        super();
        this.rebuild();
    }

    /**
     * Set the value of a specific key
     * @param name defines the name of the key to set
     * @param value defines the value to set
     * @param markAsUnprocessedIfDirty Flag to indicate to the cache that this value needs processing
     */
    public setValue(name: string, value: any, markAsUnprocessedIfDirty = false) {
        if (this[name] === undefined) {
            this._keys.push(name);
        }

        if (markAsUnprocessedIfDirty && this[name] !== value) {
            this.markAsUnprocessed();
        }

        this[name] = value;
    }
}

const onCreatedEffectParameters = { effect: null as unknown as Effect, subMesh: null as unknown as Nullable<SubMesh> };

/**
 * Class used to render data generated by a node based material
 */
export class CoreNodeMaterial extends PushMaterial {
    private _cachedWorldViewMatrix = new Matrix();
    private _cachedWorldViewProjectionMatrix = new Matrix();
    private _shaderLanguage = CoreNodeMaterial.DefaultShaderLanguage;
    protected _vertexCompilationState: CoreNodeMaterialBuildState;
    protected _fragmentCompilationState: CoreNodeMaterialBuildState;

    /** Defines default shader language when no option is defined */
    public static DefaultShaderLanguage = ShaderLanguage.GLSL;

    /**
     * Defines the maximum number of lights that can be used in the material
     */
    public maxSimultaneousLights = 4;

    /** Gets or sets the active shader language */
    public get shaderLanguage(): ShaderLanguage {
        return this._shaderLanguage;
    }

    public set shaderLanguage(value: ShaderLanguage) {
        this._shaderLanguage = value;
    }

    /**
     * Create a new node based material
     * @param name defines the material name
     * @param scene defines the hosting scene
     * @param vertexCompilationState defines vertex shader compilation state
     * @param fragmentCompilationState defines fragment shader compilation state
     * @param options defines creation option
     */
    constructor(
        name: string,
        scene?: Scene,
        vertexCompilationState?: CoreNodeMaterialBuildState,
        fragmentCompilationState?: CoreNodeMaterialBuildState,
        options: Partial<INodeMaterialOptions> = {}
    ) {
        super(name, scene || EngineStore.LastCreatedScene!);

        this._shaderLanguage = options.shaderLanguage || CoreNodeMaterial.DefaultShaderLanguage;

        if (vertexCompilationState) {
            this._vertexCompilationState = vertexCompilationState;
        }

        if (fragmentCompilationState) {
            this._fragmentCompilationState = fragmentCompilationState;
        }
    }

    private _prepareDefinesForAttributes(mesh: AbstractMesh, defines: NodeMaterialDefines) {
        const oldNormal = defines["NORMAL"];
        const oldTangent = defines["TANGENT"];
        const oldColor = defines["VERTEXCOLOR_NME"];

        defines["NORMAL"] = mesh.isVerticesDataPresent(VertexBuffer.NormalKind);
        defines["TANGENT"] = mesh.isVerticesDataPresent(VertexBuffer.TangentKind);

        const hasVertexColors = mesh.useVertexColors && mesh.isVerticesDataPresent(VertexBuffer.ColorKind);
        defines["VERTEXCOLOR_NME"] = hasVertexColors;

        let uvChanged = false;
        for (let i = 1; i <= Constants.MAX_SUPPORTED_UV_SETS; ++i) {
            const oldUV = defines["UV" + i];
            defines["UV" + i] = mesh.isVerticesDataPresent(`uv${i === 1 ? "" : i}`);
            uvChanged = uvChanged || defines["UV" + i] !== oldUV;
        }

        // PrePass
        const oit = this.needAlphaBlendingForMesh(mesh) && this.getScene().useOrderIndependentTransparency;
        PrepareDefinesForPrePass(this.getScene(), defines, !oit);

        if (oldNormal !== defines["NORMAL"] || oldTangent !== defines["TANGENT"] || oldColor !== defines["VERTEXCOLOR_NME"] || uvChanged) {
            defines.markAsAttributesDirty();
        }
    }

    protected _processDefines(
        mesh: AbstractMesh,
        defines: NodeMaterialDefines,
        useInstances = false,
        subMesh?: SubMesh
    ): Nullable<{
        lightDisposed: boolean;
        uniformBuffers: string[];
        mergedUniforms: string[];
        mergedSamplers: string[];
        fallbacks: EffectFallbacks;
    }> {
        let result = null;

        // Global defines
        const scene = this.getScene();
        if (PrepareDefinesForCamera(scene, defines)) {
            defines.markAsMiscDirty();
        }

        // Shared defines
        this._sharedData.blocksWithDefines.forEach((b) => {
            b.initializeDefines(mesh, this, defines, useInstances);
        });

        this._sharedData.blocksWithDefines.forEach((b) => {
            b.prepareDefines(mesh, this, defines, useInstances, subMesh);
        });

        // Need to recompile?
        if (defines.isDirty) {
            const lightDisposed = defines._areLightsDisposed;
            defines.markAsProcessed();

            // Repeatable content generators
            this._vertexCompilationState.compilationString = this._vertexCompilationState._builtCompilationString;
            this._fragmentCompilationState.compilationString = this._fragmentCompilationState._builtCompilationString;

            this._sharedData.repeatableContentBlocks.forEach((b) => {
                b.replaceRepeatableContent(this._vertexCompilationState, this._fragmentCompilationState, mesh, defines);
            });

            // Uniforms
            const uniformBuffers: string[] = [];
            this._sharedData.dynamicUniformBlocks.forEach((b) => {
                b.updateUniformsAndSamples(this._vertexCompilationState, this, defines, uniformBuffers);
            });

            const mergedUniforms = this._vertexCompilationState.uniforms;

            this._fragmentCompilationState.uniforms.forEach((u) => {
                const index = mergedUniforms.indexOf(u);

                if (index === -1) {
                    mergedUniforms.push(u);
                }
            });

            // Samplers
            const mergedSamplers = this._vertexCompilationState.samplers;

            this._fragmentCompilationState.samplers.forEach((s) => {
                const index = mergedSamplers.indexOf(s);

                if (index === -1) {
                    mergedSamplers.push(s);
                }
            });

            const fallbacks = new EffectFallbacks();

            this._sharedData.blocksWithFallbacks.forEach((b) => {
                b.provideFallbacks(mesh, fallbacks);
            });

            result = {
                lightDisposed,
                uniformBuffers,
                mergedUniforms,
                mergedSamplers,
                fallbacks,
            };
        }

        return result;
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
        const scene = this.getScene();
        const drawWrapper = subMesh._drawWrapper;

        if (drawWrapper.effect && this.isFrozen) {
            if (drawWrapper._wasPreviouslyReady && drawWrapper._wasPreviouslyUsingInstances === useInstances) {
                return true;
            }
        }

        if (!subMesh.materialDefines) {
            subMesh.materialDefines = new NodeMaterialDefines();
        }

        const defines = <NodeMaterialDefines>subMesh.materialDefines;
        if (this._isReadyForSubMesh(subMesh)) {
            return true;
        }

        const engine = scene.getEngine();

        this._prepareDefinesForAttributes(mesh, defines);

        // Check if blocks are ready
        if (this._sharedData.blockingBlocks.some((b) => !b.isReady(mesh, this, defines, useInstances))) {
            return false;
        }

        const result = this._processDefines(mesh, defines, useInstances, subMesh);

        if (result) {
            const previousEffect = subMesh.effect;
            // Compilation
            const join = defines.toString();
            let effect = engine.createEffect(
                {
                    vertex: "nodeMaterial" + this.name,
                    fragment: "nodeMaterial" + this.name,
                    vertexSource: this._vertexCompilationState.compilationString,
                    fragmentSource: this._fragmentCompilationState.compilationString,
                },
                <IEffectCreationOptions>{
                    attributes: this._vertexCompilationState.attributes,
                    uniformsNames: result.mergedUniforms,
                    uniformBuffersNames: result.uniformBuffers,
                    samplers: result.mergedSamplers,
                    defines: join,
                    fallbacks: result.fallbacks,
                    onCompiled: this.onCompiled,
                    onError: this.onError,
                    multiTarget: defines.PREPASS,
                    indexParameters: { maxSimultaneousLights: this.maxSimultaneousLights, maxSimultaneousMorphTargets: defines.NUM_MORPH_INFLUENCERS },
                    shaderLanguage: this.shaderLanguage,
                },
                engine
            );

            if (effect) {
                if (this._onEffectCreatedObservable) {
                    onCreatedEffectParameters.effect = effect;
                    onCreatedEffectParameters.subMesh = subMesh;
                    this._onEffectCreatedObservable.notifyObservers(onCreatedEffectParameters);
                }

                // Use previous effect while new one is compiling
                if (this.allowShaderHotSwapping && previousEffect && !effect.isReady()) {
                    effect = previousEffect;
                    defines.markAsUnprocessed();

                    if (result.lightDisposed) {
                        // re register in case it takes more than one frame.
                        defines._areLightsDisposed = true;
                        return false;
                    }
                } else {
                    scene.resetCachedMaterial();
                    subMesh.setEffect(effect, defines, this._materialContext);
                }
            }
        }

        if (!subMesh.effect || !subMesh.effect.isReady()) {
            return false;
        }

        defines._renderId = scene.getRenderId();
        drawWrapper._wasPreviouslyReady = true;
        drawWrapper._wasPreviouslyUsingInstances = useInstances;

        this._checkScenePerformancePriority();

        return true;
    }

    /**
     * Binds the world matrix to the material
     * @param world defines the world transformation matrix
     */
    public override bindOnlyWorldMatrix(world: Matrix): void {
        const scene = this.getScene();

        if (!this._activeEffect) {
            return;
        }

        const hints = this._sharedData.hints;

        if (hints.needWorldViewMatrix) {
            world.multiplyToRef(scene.getViewMatrix(), this._cachedWorldViewMatrix);
        }

        if (hints.needWorldViewProjectionMatrix) {
            world.multiplyToRef(scene.getTransformMatrix(), this._cachedWorldViewProjectionMatrix);
        }

        // Connection points
        for (const inputBlock of this._sharedData.inputBlocks) {
            inputBlock._transmitWorld(this._activeEffect, world, this._cachedWorldViewMatrix, this._cachedWorldViewProjectionMatrix);
        }
    }

    /**
     * Binds the submesh to this material by preparing the effect and shader to draw
     * @param world defines the world transformation matrix
     * @param mesh defines the mesh containing the submesh
     * @param subMesh defines the submesh to bind the material to
     */
    public override bindForSubMesh(world: Matrix, mesh: Mesh, subMesh: SubMesh): void {
        const scene = this.getScene();
        const effect = subMesh.effect;
        if (!effect) {
            return;
        }
        this._activeEffect = effect;

        // Matrices
        this.bindOnlyWorldMatrix(world);

        const mustRebind = this._mustRebind(scene, effect, subMesh, mesh.visibility);
        const sharedData = this._sharedData;

        if (mustRebind) {
            // Bindable blocks
            for (const block of sharedData.bindableBlocks) {
                block.bind(effect, this, mesh, subMesh);
            }

            for (const block of sharedData.forcedBindableBlocks) {
                block.bind(effect, this, mesh, subMesh);
            }

            // Connection points
            for (const inputBlock of sharedData.inputBlocks) {
                inputBlock._transmit(effect, scene, this);
            }
        } else if (!this.isFrozen) {
            for (const block of sharedData.forcedBindableBlocks) {
                block.bind(effect, this, mesh, subMesh);
            }
        }

        this._afterBind(mesh, this._activeEffect, subMesh);
    }
}
