import { NodeMaterialBlock } from "../../nodeMaterialBlock";
import { NodeMaterialBlockConnectionPointTypes } from "../../Enums/nodeMaterialBlockConnectionPointTypes";
import type { NodeMaterialBuildState } from "../../nodeMaterialBuildState";
import { NodeMaterialBlockTargets } from "../../Enums/nodeMaterialBlockTargets";
import type { NodeMaterialConnectionPoint } from "../../nodeMaterialBlockConnectionPoint";
import type { AbstractMesh } from "../../../../Meshes/abstractMesh";
import type { NodeMaterial, NodeMaterialDefines } from "../../nodeMaterial";
import type { Effect } from "../../../effect";
import type { Mesh } from "../../../../Meshes/mesh";
import { VertexBuffer } from "../../../../Buffers/buffer";
import { InputBlock } from "../Input/inputBlock";
import { RegisterClass } from "../../../../Misc/typeStore";

import { BindMorphTargetParameters, PrepareDefinesForMorphTargets } from "../../../materialHelper.functions";
import { ShaderLanguage } from "core/Materials/shaderLanguage";

/**
 * Block used to add morph targets support to vertex shader
 */
export class MorphTargetsBlock extends NodeMaterialBlock {
    private _repeatableContentAnchor: string;

    /**
     * Create a new MorphTargetsBlock
     * @param name defines the block name
     */
    public constructor(name: string) {
        super(name, NodeMaterialBlockTargets.Vertex);

        this.registerInput("position", NodeMaterialBlockConnectionPointTypes.Vector3);
        this.registerInput("normal", NodeMaterialBlockConnectionPointTypes.Vector3);
        this.registerInput("tangent", NodeMaterialBlockConnectionPointTypes.AutoDetect);
        this.tangent.addExcludedConnectionPointFromAllowedTypes(
            NodeMaterialBlockConnectionPointTypes.Color4 | NodeMaterialBlockConnectionPointTypes.Vector4 | NodeMaterialBlockConnectionPointTypes.Vector3
        );
        this.registerInput("uv", NodeMaterialBlockConnectionPointTypes.Vector2);
        this.registerOutput("positionOutput", NodeMaterialBlockConnectionPointTypes.Vector3);
        this.registerOutput("normalOutput", NodeMaterialBlockConnectionPointTypes.Vector3);
        this.registerOutput("tangentOutput", NodeMaterialBlockConnectionPointTypes.Vector4);
        this.registerOutput("uvOutput", NodeMaterialBlockConnectionPointTypes.Vector2);
    }

    /**
     * Gets the current class name
     * @returns the class name
     */
    public override getClassName() {
        return "MorphTargetsBlock";
    }

    /**
     * Gets the position input component
     */
    public get position(): NodeMaterialConnectionPoint {
        return this._inputs[0];
    }

    /**
     * Gets the normal input component
     */
    public get normal(): NodeMaterialConnectionPoint {
        return this._inputs[1];
    }

    /**
     * Gets the tangent input component
     */
    public get tangent(): NodeMaterialConnectionPoint {
        return this._inputs[2];
    }

    /**
     * Gets the tangent input component
     */
    public get uv(): NodeMaterialConnectionPoint {
        return this._inputs[3];
    }

    /**
     * Gets the position output component
     */
    public get positionOutput(): NodeMaterialConnectionPoint {
        return this._outputs[0];
    }

    /**
     * Gets the normal output component
     */
    public get normalOutput(): NodeMaterialConnectionPoint {
        return this._outputs[1];
    }

    /**
     * Gets the tangent output component
     */
    public get tangentOutput(): NodeMaterialConnectionPoint {
        return this._outputs[2];
    }

    /**
     * Gets the tangent output component
     */
    public get uvOutput(): NodeMaterialConnectionPoint {
        return this._outputs[3];
    }

    public override initialize(state: NodeMaterialBuildState) {
        state._excludeVariableName("morphTargetInfluences");

        this._initShaderSourceAsync(state.shaderLanguage);
    }

    private async _initShaderSourceAsync(shaderLanguage: ShaderLanguage) {
        this._codeIsReady = false;

        if (shaderLanguage === ShaderLanguage.WGSL) {
            await import(
                /* webpackChunkName: "morphTargetsVertex.wgsl" */
                "../../../../ShadersWGSL/ShadersInclude/morphTargetsVertex"
            );
            await import(
                /* webpackChunkName: "morphTargetsVertexDeclaration.wgsl" */
                "../../../../ShadersWGSL/ShadersInclude/morphTargetsVertexDeclaration"
            );
            await import(
                /* webpackChunkName: "morphTargetsVertexGlobal.wgsl" */
                "../../../../ShadersWGSL/ShadersInclude/morphTargetsVertexGlobal"
            );
            await import(
                /* webpackChunkName: "morphTargetsVertexGlobalDeclaration.wgsl" */
                "../../../../ShadersWGSL/ShadersInclude/morphTargetsVertexGlobalDeclaration"
            );
        } else {
            await import(
                /* webpackChunkName: "morphTargetsVertex.glsl" */
                "../../../../Shaders/ShadersInclude/morphTargetsVertex"
            );
            await import(
                /* webpackChunkName: "morphTargetsVertexDeclaration.glsl" */
                "../../../../Shaders/ShadersInclude/morphTargetsVertexDeclaration"
            );
            await import(
                /* webpackChunkName: "morphTargetsVertexGlobal.glsl" */
                "../../../../Shaders/ShadersInclude/morphTargetsVertexGlobal"
            );
            await import(
                /* webpackChunkName: "morphTargetsVertexGlobalDeclaration.glsl" */
                "../../../../Shaders/ShadersInclude/morphTargetsVertexGlobalDeclaration"
            );
        }

        this._codeIsReady = true;
        this.onCodeIsReadyObservable.notifyObservers(this);
    }

    public override autoConfigure(material: NodeMaterial, additionalFilteringInfo: (node: NodeMaterialBlock) => boolean = () => true) {
        if (!this.position.isConnected) {
            let positionInput = material.getInputBlockByPredicate((b) => b.isAttribute && b.name === "position" && additionalFilteringInfo(b));

            if (!positionInput) {
                positionInput = new InputBlock("position");
                positionInput.setAsAttribute();
            }
            positionInput.output.connectTo(this.position);
        }
        if (!this.normal.isConnected) {
            let normalInput = material.getInputBlockByPredicate((b) => b.isAttribute && b.name === "normal" && additionalFilteringInfo(b));

            if (!normalInput) {
                normalInput = new InputBlock("normal");
                normalInput.setAsAttribute("normal");
            }
            normalInput.output.connectTo(this.normal);
        }
        if (!this.tangent.isConnected) {
            let tangentInput = material.getInputBlockByPredicate((b) => b.isAttribute && b.name === "tangent" && additionalFilteringInfo(b));

            if (!tangentInput) {
                tangentInput = new InputBlock("tangent");
                tangentInput.setAsAttribute("tangent");
            }
            tangentInput.output.connectTo(this.tangent);
        }
        if (!this.uv.isConnected) {
            let uvInput = material.getInputBlockByPredicate((b) => b.isAttribute && b.name === "uv" && additionalFilteringInfo(b));

            if (!uvInput) {
                uvInput = new InputBlock("uv");
                uvInput.setAsAttribute("uv");
            }
            uvInput.output.connectTo(this.uv);
        }
    }

    public override prepareDefines(mesh: AbstractMesh, nodeMaterial: NodeMaterial, defines: NodeMaterialDefines) {
        if ((<Mesh>mesh).morphTargetManager) {
            const morphTargetManager = (<Mesh>mesh).morphTargetManager;

            if (morphTargetManager?.isUsingTextureForTargets && (morphTargetManager.numMaxInfluencers || morphTargetManager.numInfluencers) !== defines["NUM_MORPH_INFLUENCERS"]) {
                defines.markAsAttributesDirty();
            }
        }

        if (!defines._areAttributesDirty) {
            return;
        }

        PrepareDefinesForMorphTargets(mesh, defines);
    }

    public override bind(effect: Effect, nodeMaterial: NodeMaterial, mesh?: Mesh) {
        if (mesh && mesh.morphTargetManager && mesh.morphTargetManager.numInfluencers > 0) {
            BindMorphTargetParameters(mesh, effect);

            if (mesh.morphTargetManager.isUsingTextureForTargets) {
                mesh.morphTargetManager._bind(effect);
            }
        }
    }

    public override replaceRepeatableContent(
        vertexShaderState: NodeMaterialBuildState,
        fragmentShaderState: NodeMaterialBuildState,
        mesh: AbstractMesh,
        defines: NodeMaterialDefines
    ) {
        const position = this.position;
        const normal = this.normal;
        const tangent = this.tangent;
        const uv = this.uv;
        const positionOutput = this.positionOutput;
        const normalOutput = this.normalOutput;
        const tangentOutput = this.tangentOutput;
        const uvOutput = this.uvOutput;
        const state = vertexShaderState;
        const repeatCount = defines.NUM_MORPH_INFLUENCERS as number;

        const manager = (<Mesh>mesh).morphTargetManager;
        const hasNormals = manager && manager.supportsNormals && defines["NORMAL"];
        const hasTangents = manager && manager.supportsTangents && defines["TANGENT"];
        const hasUVs = manager && manager.supportsUVs && defines["UV1"];

        let injectionCode = "";

        if (manager?.isUsingTextureForTargets && repeatCount > 0) {
            injectionCode += `${state._declareLocalVar("vertexID", NodeMaterialBlockConnectionPointTypes.Float)};\n`;
        }

        injectionCode += `#ifdef MORPHTARGETS\n`;
        const isWebGPU = state.shaderLanguage === ShaderLanguage.WGSL;
        const uniformsPrefix = isWebGPU ? "uniforms." : "";
        if (manager?.isUsingTextureForTargets) {
            injectionCode += `for (${isWebGPU ? "var" : "int"} i = 0; i < NUM_MORPH_INFLUENCERS; i++) {\n`;
            injectionCode += `if (i >= ${uniformsPrefix}morphTargetCount) { break; }\n`;

            injectionCode += `vertexID = ${isWebGPU ? "f32(vertexInputs.vertexIndex" : "float(gl_VertexID"}) * ${uniformsPrefix}morphTargetTextureInfo.x;\n`;
            injectionCode += `${positionOutput.associatedVariableName} += (readVector3FromRawSampler(i, vertexID) - ${position.associatedVariableName}) * ${uniformsPrefix}morphTargetInfluences[i];\n`;
            injectionCode += `vertexID += 1.0;\n`;

            if (hasNormals) {
                injectionCode += `#ifdef MORPHTARGETS_NORMAL\n`;
                injectionCode += `${normalOutput.associatedVariableName} += (readVector3FromRawSampler(i, vertexID) - ${normal.associatedVariableName}) * ${uniformsPrefix}morphTargetInfluences[i];\n`;
                injectionCode += `vertexID += 1.0;\n`;
                injectionCode += `#endif\n`;
            }

            if (hasUVs) {
                injectionCode += `#ifdef MORPHTARGETS_UV\n`;
                injectionCode += `${uvOutput.associatedVariableName} += (readVector3FromRawSampler(i, vertexID).xy - ${uv.associatedVariableName}) * ${uniformsPrefix}morphTargetInfluences[i];\n`;
                injectionCode += `vertexID += 1.0;\n`;
                injectionCode += `#endif\n`;
            }

            if (hasTangents) {
                injectionCode += `#ifdef MORPHTARGETS_TANGENT\n`;
                injectionCode += `${tangentOutput.associatedVariableName}.xyz += (readVector3FromRawSampler(i, vertexID) - ${tangent.associatedVariableName}.xyz) * ${uniformsPrefix}morphTargetInfluences[i];\n`;

                if (tangent.type === NodeMaterialBlockConnectionPointTypes.Vector4) {
                    injectionCode += `${tangentOutput.associatedVariableName}.w = ${tangent.associatedVariableName}.w;\n`;
                } else {
                    injectionCode += `${tangentOutput.associatedVariableName}.w = 1.;\n`;
                }
                injectionCode += `#endif\n`;
            }

            injectionCode += "}\n";
        } else {
            for (let index = 0; index < repeatCount; index++) {
                injectionCode += `${positionOutput.associatedVariableName} += (position${index} - ${position.associatedVariableName}) * ${uniformsPrefix}morphTargetInfluences[${index}];\n`;

                if (hasNormals) {
                    injectionCode += `#ifdef MORPHTARGETS_NORMAL\n`;
                    injectionCode += `${normalOutput.associatedVariableName} += (normal${index} - ${normal.associatedVariableName}) * ${uniformsPrefix}morphTargetInfluences[${index}];\n`;
                    injectionCode += `#endif\n`;
                }

                if (hasUVs) {
                    injectionCode += `#ifdef MORPHTARGETS_UV\n`;
                    injectionCode += `${uvOutput.associatedVariableName}.xy += (uv_${index} - ${uv.associatedVariableName}.xy) * ${uniformsPrefix}morphTargetInfluences[${index}];\n`;
                    injectionCode += `#endif\n`;
                }

                if (hasTangents) {
                    injectionCode += `#ifdef MORPHTARGETS_TANGENT\n`;
                    injectionCode += `${tangentOutput.associatedVariableName}.xyz += (tangent${index} - ${tangent.associatedVariableName}.xyz) * ${uniformsPrefix}morphTargetInfluences[${index}];\n`;

                    if (tangent.type === NodeMaterialBlockConnectionPointTypes.Vector4) {
                        injectionCode += `${tangentOutput.associatedVariableName}.w = ${tangent.associatedVariableName}.w;\n`;
                    } else {
                        injectionCode += `${tangentOutput.associatedVariableName}.w = 1.;\n`;
                    }
                    injectionCode += `#endif\n`;
                }
            }
        }
        injectionCode += `#endif\n`;

        state.compilationString = state.compilationString.replace(this._repeatableContentAnchor, injectionCode);

        if (repeatCount > 0) {
            for (let index = 0; index < repeatCount; index++) {
                state.attributes.push(VertexBuffer.PositionKind + index);

                if (hasNormals) {
                    state.attributes.push(VertexBuffer.NormalKind + index);
                }

                if (hasTangents) {
                    state.attributes.push(VertexBuffer.TangentKind + index);
                }

                if (hasUVs) {
                    state.attributes.push(VertexBuffer.UVKind + "_" + index);
                }
            }
        }
    }

    protected override _buildBlock(state: NodeMaterialBuildState) {
        super._buildBlock(state);

        // Register for defines
        state.sharedData.blocksWithDefines.push(this);

        // Register for binding
        state.sharedData.bindableBlocks.push(this);

        // Register for repeatable content generation
        state.sharedData.repeatableContentBlocks.push(this);

        // Emit code
        const position = this.position;
        const normal = this.normal;
        const tangent = this.tangent;
        const uv = this.uv;
        const positionOutput = this.positionOutput;
        const normalOutput = this.normalOutput;
        const tangentOutput = this.tangentOutput;
        const uvOutput = this.uvOutput;
        const comments = `//${this.name}`;

        state.uniforms.push("morphTargetInfluences");
        state.uniforms.push("morphTargetCount");
        state.uniforms.push("morphTargetTextureInfo");
        state.uniforms.push("morphTargetTextureIndices");
        state.samplers.push("morphTargets");

        state._emitFunctionFromInclude("morphTargetsVertexGlobalDeclaration", comments);
        state._emitFunctionFromInclude("morphTargetsVertexDeclaration", comments, {
            repeatKey: "maxSimultaneousMorphTargets",
        });

        state.compilationString += `${state._declareOutput(positionOutput)} = ${position.associatedVariableName};\n`;
        state.compilationString += `#ifdef NORMAL\n`;
        state.compilationString += `${state._declareOutput(normalOutput)} = ${normal.associatedVariableName};\n`;
        state.compilationString += `#else\n`;
        state.compilationString += `${state._declareOutput(normalOutput)} = vec3(0., 0., 0.);\n`;
        state.compilationString += `#endif\n`;
        state.compilationString += `#ifdef TANGENT\n`;
        state.compilationString += `${state._declareOutput(tangentOutput)} = ${tangent.associatedVariableName};\n`;
        state.compilationString += `#else\n`;
        state.compilationString += `${state._declareOutput(tangentOutput)} = vec4(0., 0., 0., 0.);\n`;
        state.compilationString += `#endif\n`;
        state.compilationString += `#ifdef UV1\n`;
        state.compilationString += `${state._declareOutput(uvOutput)} = ${uv.associatedVariableName};\n`;
        state.compilationString += `#else\n`;
        state.compilationString += `${state._declareOutput(uvOutput)} = vec2(0., 0.);\n`;
        state.compilationString += `#endif\n`;

        // Repeatable content
        this._repeatableContentAnchor = state._repeatableContentAnchor;
        state.compilationString += this._repeatableContentAnchor;

        return this;
    }
}

RegisterClass("BABYLON.MorphTargetsBlock", MorphTargetsBlock);
