import * as THREE from 'three/webgpu';
import {
	vec3, vec4, uvec3, float, Fn, uniform,
	texture3D, textureStore, instanceIndex,
	screenCoordinate, pass,
	smoothstep, mix, min, max, floor,
	mx_noise_float, storage, storageTexture, If, cameraPosition, hue,
	Loop, positionWorld, positionLocal,
	interleavedGradientNoise, frameId, fract,
	saturation, cos, sin, atan,
} from 'three/tsl';

import { snoise, snoiseVec3 } from 'three/addons/tsl/math/curlNoise.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import WebGPU from 'three/addons/capabilities/WebGPU.js';

import {
	FIRE_MOODS,
	MOOD_CYCLE_MS,
	MOOD_BLEND_MS,
	blendMoodIntoColors,
	blendMoodScalars,
} from './fire-moods.js';

const GRID_SIZE_X = 100;
const GRID_SIZE_Y = 100;
const GRID_SIZE_Z = 200;
const CELL_COUNT = GRID_SIZE_X * GRID_SIZE_Y * GRID_SIZE_Z;
const PRESSURE_ITERATIONS = 2;
const VOLUME_WORLD_SIZE_X = 12;
const VOLUME_WORLD_SIZE_Y = 12;
const VOLUME_WORLD_SIZE_Z = 24;
const VOLUME_WORLD_SIZE_DIAGONAL = Math.sqrt(
	VOLUME_WORLD_SIZE_X ** 2 + VOLUME_WORLD_SIZE_Y ** 2 + VOLUME_WORLD_SIZE_Z ** 2,
);
const TEXEL_X = 1 / GRID_SIZE_X;
const TEXEL_Y = 1 / GRID_SIZE_Y;
const TEXEL_Z = 1 / GRID_SIZE_Z;

const VOID_BACKGROUND = 0x080402;
const BLOOM_THRESHOLD = 0.28;
const BLOOM_RADIUS = 1.0;
const VOLUMETRIC_RESOLUTION = 0.65;
const VOLUME_SCALE = new THREE.Vector3( 1.35, 1.65, 1.35 );

/**
 * @param {HTMLElement} container
 * @returns {Promise<{ dispose: () => void } | null>}
 */
export async function createVolumeFire( container ) {

	if ( WebGPU.isAvailable() === false ) {

		return null;

	}

	const uVolumeWorldSize = uniform( new THREE.Vector3(
		VOLUME_WORLD_SIZE_X * VOLUME_SCALE.x,
		VOLUME_WORLD_SIZE_Y * VOLUME_SCALE.y,
		VOLUME_WORLD_SIZE_Z * VOLUME_SCALE.z,
	) );

	let renderer;
	let scene;
	let camera;
	let volumetricMesh;
	let emitter;
	let keyLight;
	let pointLight;
	let renderPipeline;
	let bloomPass;
	let denoiseStrength;
	let params;
	let uKeyLightPos;

	let emitterVerticesBuffer;
	let vertexCount;
	const prevEmitterPos = new THREE.Vector3();

	let velTexA;
	let velTexB;
	let dyeTexA;
	let dyeTexB;
	let divTex;
	let pressTexA;
	let pressTexB;
	let dyeTexNode;
	let dyeTexWriteNode;
	let curlNoiseTex;
	let curlNoiseTexNode;

	let advectVelocityPass;
	let divergencePass;
	let jacobiPassAB;
	let jacobiPassBA;
	let projectPass;
	let advectDyePass;
	let emitEmitterPass;
	let computeCurlNoisePass;

	const uDt = uniform( 0.016 );
	const uTime = uniform( 0 );

	const uBuoyancy = uniform( FIRE_MOODS[ 0 ].buoyancy );
	const uWeight = uniform( 0.15 );
	const uTurbulence = uniform( FIRE_MOODS[ 0 ].turbulence );
	const uTurbulenceDecay = uniform( 0.1 );
	const uTurbFrequency = uniform( 10.0 );
	const uVelDamping = uniform( 0.25 );

	const uCooling = uniform( 1.0 / FIRE_MOODS[ 0 ].fireLifespan );
	const uDissipation = uniform( 1.0 / FIRE_MOODS[ 0 ].smokeLifespan );

	const uEmitDensity = uniform( FIRE_MOODS[ 0 ].emitDensity );
	const uEmitTemperature = uniform( FIRE_MOODS[ 0 ].emitTemperature );

	const uEmitterMatrix = uniform( new THREE.Matrix4() );
	const uEmitterSpeed = uniform( 0.0 );
	const uMotionBoost = uniform( 0.25 );
	const uEmitterVelocity = uniform( new THREE.Vector3() );
	const uEmitterPosition = uniform( new THREE.Vector3() );

	const uFireIntensity = uniform( FIRE_MOODS[ 0 ].fireIntensity );
	const uEmitterEmissiveIntensity = uniform( 0.2 );
	const uFireGlowSpread = uniform( 5.0 );
	const uShadowAbsorption = uniform( 2.0 );
	const uShadowAmbient = uniform( 0.5 );
	const uFireStartColor = uniform( new THREE.Color( FIRE_MOODS[ 0 ].fireStartColor ) );
	const uFireMidColor = uniform( new THREE.Color( FIRE_MOODS[ 0 ].fireMidColor ) );
	const uFireEndColor = uniform( new THREE.Color( FIRE_MOODS[ 0 ].fireEndColor ) );
	const uFireHue = uniform( THREE.MathUtils.degToRad( FIRE_MOODS[ 0 ].fireHue ) );
	const uAsymmetry = uniform( 0.0 );
	const uPowderStrength = uniform( 0.59 );
	const uMultiScattering = uniform( 1.0 );
	const uPointLightVolumeIntensity = uniform( 2.0 );
	const uPointLightSurfaceIntensity = uniform( 10.0 );
	const uLightNearIntensity = uniform( 10.0 );
	const uLightFarIntensity = uniform( 15.0 );
	const uLightFarDistance = uniform( 10.0 );
	const uPointLightProjectionRadius = uniform( 20.0 );
	const uPointLightProjectionFrequency = uniform( 0.2 );
	const uPointLightProjectionNoiseFade = uniform( 17.0 );
	const uPointLightProjectionCenterFade = uniform( 3.25 );

	const uFlameHeight = uniform( 5.2 );
	const uSway = uniform( new THREE.Vector3() );
	const uFlicker = uniform( 1.0 );
	const uColorNoise = uniform( 0.0 );
	const uSaturation = uniform( 1.1 );
	const cpuNoise = new ImprovedNoise();

	const cameraBase = new THREE.Vector3( 0, 4.2, 0 );
	const cameraTarget = new THREE.Vector3( 0, 9.5, 0 );
	let cameraDistance = 20;

	let simulationTime = 0;
	let lastTime = performance.now();
	let simAccumulator = 0;
	const moodStartTime = performance.now();

	function createStorage3D( name ) {

		const texture = new THREE.Storage3DTexture( GRID_SIZE_X, GRID_SIZE_Y, GRID_SIZE_Z );
		texture.name = name;
		texture.format = THREE.RGBAFormat;
		texture.type = THREE.HalfFloatType;
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		texture.wrapS = THREE.ClampToEdgeWrapping;
		texture.wrapT = THREE.ClampToEdgeWrapping;
		texture.wrapR = THREE.ClampToEdgeWrapping;

		return texture;

	}

	const getVoxelCoord = ( id ) => {

		const x = id.mod( GRID_SIZE_X );
		const y = id.div( GRID_SIZE_X ).mod( GRID_SIZE_Y );
		const z = id.div( GRID_SIZE_X * GRID_SIZE_Y );

		return uvec3( x, y, z );

	};

	const coordToUVW = ( coord ) => vec3( coord ).add( 0.5 ).div( vec3( GRID_SIZE_X, GRID_SIZE_Y, GRID_SIZE_Z ) );

	function createComputePasses() {

		computeCurlNoisePass = Fn( () => {

			const coord = getVoxelCoord( instanceIndex );
			const uvw = coordToUVW( coord );

			const freq = uTurbFrequency;
			const e = float( 0.1 ).div( freq );
			const dx = vec3( e, 0.0, 0.0 );
			const dy = vec3( 0.0, e, 0.0 );
			const dz = vec3( 0.0, 0.0, e );

			const p = uvw.mul( vec3( VOLUME_WORLD_SIZE_X / VOLUME_WORLD_SIZE_Y, 1.0, VOLUME_WORLD_SIZE_Z / VOLUME_WORLD_SIZE_Y ) );
			const p_x0 = snoiseVec3( p.sub( dx ).mul( freq ) );
			const p_x1 = snoiseVec3( p.add( dx ).mul( freq ) );
			const p_y0 = snoiseVec3( p.sub( dy ).mul( freq ) );
			const p_y1 = snoiseVec3( p.add( dy ).mul( freq ) );
			const p_z0 = snoiseVec3( p.sub( dz ).mul( freq ) );
			const p_z1 = snoiseVec3( p.add( dz ).mul( freq ) );

			const x = p_y1.z.sub( p_y0.z ).sub( p_z1.y ).add( p_z0.y );
			const y = p_z1.x.sub( p_z0.x ).sub( p_x1.z ).add( p_x0.z );
			const z = p_x1.y.sub( p_x0.y ).sub( p_y1.x ).add( p_y0.x );

			const noiseVal = vec3( x, y, z ).mul( 5.0 );

			textureStore( curlNoiseTex, coord, vec4( noiseVal, 0.0 ) ).toWriteOnly();

		} )().compute( CELL_COUNT ).setName( 'computeCurlNoise' );

		advectVelocityPass = Fn( () => {

			const coord = getVoxelCoord( instanceIndex );
			const uvw = coordToUVW( coord );

			const vel = texture3D( velTexA, uvw, 0 ).xyz;

			const velUVW = vel.div( uVolumeWorldSize );
			const prevPos = uvw.sub( velUVW.mul( uDt ) );
			const newVel = texture3D( velTexA, prevPos, 0 ).xyz.toVar();

			const dye = dyeTexNode.sample( uvw ).level( 0 );
			const density = dye.r;
			const temperature = dye.g;
			const age = dye.b;

			const buoyancyForce = temperature.mul( uBuoyancy ).sub( density.mul( uWeight ) ).mul( VOLUME_WORLD_SIZE_Y );
			newVel.addAssign( vec3( 0, buoyancyForce, 0 ).mul( uDt ) );

			const thermalNoisePos = uvw.add( vec3( 0, age.negate().mul( 0.6 ), age.mul( 0.13 ) ).div( uTurbFrequency ) );
			const decay = age.mul( uTurbulenceDecay.negate() ).exp();
			const thermalTurbulence = curlNoiseTexNode.sample( thermalNoisePos ).level( 0 ).xyz.mul( uTurbulence ).mul( temperature ).mul( decay );

			const ambientNoisePos = uvw.mul( 0.5 ).add( vec3( 0, uTime.mul( 0.25 ), uTime.mul( 0.06 ) ).div( uTurbFrequency ) );
			const ambientTurbulence = curlNoiseTexNode.sample( ambientNoisePos ).level( 0 ).xyz.mul( uTurbulence.mul( 0.2 ) ).mul( density );

			const turbulence = thermalTurbulence.add( ambientTurbulence ).mul( VOLUME_WORLD_SIZE_Y );
			newVel.addAssign( turbulence.mul( uDt ) );

			newVel.mulAssign( max( float( 1 ).sub( uVelDamping.mul( uDt ) ), 0 ) );

			const worldPos = uvw.sub( 0.5 ).mul( uVolumeWorldSize ).add( vec3( 0, VOLUME_WORLD_SIZE_Y / 2, 0 ) );
			const dist = worldPos.distance( uEmitterPosition );
			const emitterRadius = float( 1.0 );

			If( dist.lessThan( emitterRadius ), () => {

				const ratio = dist.div( emitterRadius );
				const falloff = smoothstep( 0.0, 1.0, float( 1.0 ).sub( ratio ) );

				const windNoisePos = uvw.add( vec3( 0.0, uTime.mul( 0.5 ), 0.0 ).div( uTurbFrequency ) );
				const windTurbulence = curlNoiseTexNode.sample( windNoisePos ).level( 0 ).xyz.mul( uTurbulence ).mul( uEmitterSpeed );

				const windVel = uEmitterVelocity.mul( float( 6.5 ) ).add( windTurbulence ).mul( uDt ).mul( falloff );

				newVel.addAssign( windVel );

			} );

			const edge = min( uvw, vec3( 1 ).sub( uvw ) );
			const boundary = smoothstep( 0.0, 0.08, min( edge.x, min( edge.y, edge.z ) ) );
			newVel.mulAssign( boundary );

			textureStore( velTexB, coord, vec4( newVel, 0 ) ).toWriteOnly();

		} )().compute( CELL_COUNT ).setName( 'advectVelocity' );

		divergencePass = Fn( () => {

			const coord = getVoxelCoord( instanceIndex );
			const uvw = coordToUVW( coord );

			const vR = texture3D( velTexB, uvw.add( vec3( TEXEL_X, 0, 0 ) ), 0 ).x;
			const vL = texture3D( velTexB, uvw.sub( vec3( TEXEL_X, 0, 0 ) ), 0 ).x;
			const vU = texture3D( velTexB, uvw.add( vec3( 0, TEXEL_Y, 0 ) ), 0 ).y;
			const vD = texture3D( velTexB, uvw.sub( vec3( 0, TEXEL_Y, 0 ) ), 0 ).y;
			const vF = texture3D( velTexB, uvw.add( vec3( 0, 0, TEXEL_Z ) ), 0 ).z;
			const vB = texture3D( velTexB, uvw.sub( vec3( 0, 0, TEXEL_Z ) ), 0 ).z;

			const divergence = vR.sub( vL ).add( vU.sub( vD ) ).add( vF.sub( vB ) ).mul( 0.5 );

			textureStore( divTex, coord, vec4( divergence, 0, 0, 0 ) ).toWriteOnly();

		} )().compute( CELL_COUNT ).setName( 'divergence' );

		const jacobi = ( pressRead, pressWrite, name ) => Fn( () => {

			const coord = getVoxelCoord( instanceIndex );
			const uvw = coordToUVW( coord );

			const pR = texture3D( pressRead, uvw.add( vec3( TEXEL_X, 0, 0 ) ), 0 ).x;
			const pL = texture3D( pressRead, uvw.sub( vec3( TEXEL_X, 0, 0 ) ), 0 ).x;
			const pU = texture3D( pressRead, uvw.add( vec3( 0, TEXEL_Y, 0 ) ), 0 ).x;
			const pD = texture3D( pressRead, uvw.sub( vec3( 0, TEXEL_Y, 0 ) ), 0 ).x;
			const pF = texture3D( pressRead, uvw.add( vec3( 0, 0, TEXEL_Z ) ), 0 ).x;
			const pB = texture3D( pressRead, uvw.sub( vec3( 0, 0, TEXEL_Z ) ), 0 ).x;

			const divergence = texture3D( divTex, uvw, 0 ).x;

			const pressure = pR.add( pL ).add( pU ).add( pD ).add( pF ).add( pB ).sub( divergence ).div( 6 );

			textureStore( pressWrite, coord, vec4( pressure, 0, 0, 0 ) ).toWriteOnly();

		} )().compute( CELL_COUNT ).setName( name );

		jacobiPassAB = jacobi( pressTexA, pressTexB, 'jacobiAB' );
		jacobiPassBA = jacobi( pressTexB, pressTexA, 'jacobiBA' );

		projectPass = Fn( () => {

			const coord = getVoxelCoord( instanceIndex );
			const uvw = coordToUVW( coord );

			const pR = texture3D( pressTexA, uvw.add( vec3( TEXEL_X, 0, 0 ) ), 0 ).x;
			const pL = texture3D( pressTexA, uvw.sub( vec3( TEXEL_X, 0, 0 ) ), 0 ).x;
			const pU = texture3D( pressTexA, uvw.add( vec3( 0, TEXEL_Y, 0 ) ), 0 ).x;
			const pD = texture3D( pressTexA, uvw.sub( vec3( 0, TEXEL_Y, 0 ) ), 0 ).x;
			const pF = texture3D( pressTexA, uvw.add( vec3( 0, 0, TEXEL_Z ) ), 0 ).x;
			const pB = texture3D( pressTexA, uvw.sub( vec3( 0, 0, TEXEL_Z ) ), 0 ).x;

			const gradient = vec3( pR.sub( pL ), pU.sub( pD ), pF.sub( pB ) ).mul( 0.5 );

			const vel = texture3D( velTexB, uvw, 0 ).xyz.sub( gradient );

			textureStore( velTexA, coord, vec4( vel, 0 ) ).toWriteOnly();

		} )().compute( CELL_COUNT ).setName( 'project' );

		advectDyePass = Fn( () => {

			const coord = getVoxelCoord( instanceIndex );
			const uvw = coordToUVW( coord );

			const vel = texture3D( velTexA, uvw, 0 ).xyz;
			const velUVW = vel.div( uVolumeWorldSize );
			const prevPos = uvw.sub( velUVW.mul( uDt ) );

			const dye = dyeTexNode.sample( prevPos ).level( 0 );

			const density = dye.r.mul( max( float( 1 ).sub( uDissipation.mul( uDt ) ), 0 ) ).toVar();
			const temperature = dye.g.mul( max( float( 1 ).sub( uCooling.mul( uDt ) ), 0 ) ).toVar();

			const gridDims = vec3( GRID_SIZE_X, GRID_SIZE_Y, GRID_SIZE_Z );
			const nearestUVW = floor( prevPos.mul( gridDims ) ).add( 0.5 ).div( gridDims );
			const age = dyeTexNode.sample( nearestUVW ).level( 0 ).b.add( uDt ).toVar();

			temperature.assign( temperature.clamp( 0, 12 ) );

			If( density.lessThanEqual( 0.01 ), () => {

				age.assign( 0.0 );

			} );

			textureStore( dyeTexWriteNode, coord, vec4( density, temperature, age, 1.0 ) ).toWriteOnly();

		} )().compute( CELL_COUNT ).setName( 'advectDye' );

		emitEmitterPass = Fn( () => {

			const vertexPos = emitterVerticesBuffer.element( instanceIndex );
			const worldPos = uEmitterMatrix.mul( vec4( vertexPos, 1.0 ) ).xyz;

			const uvw = worldPos.sub( vec3( 0, VOLUME_WORLD_SIZE_Y / 2, 0 ) ).div( uVolumeWorldSize ).add( 0.5 );

			If( uvw.x.greaterThanEqual( 0 ).and( uvw.x.lessThanEqual( 1 ) )
				.and( uvw.y.greaterThanEqual( 0 ) ).and( uvw.y.lessThanEqual( 1 ) )
				.and( uvw.z.greaterThanEqual( 0 ) ).and( uvw.z.lessThanEqual( 1 ) ), () => {

				const coord = uvec3( uvw.mul( vec3( GRID_SIZE_X, GRID_SIZE_Y, GRID_SIZE_Z ) ) );

				const flicker = mx_noise_float( vertexPos.mul( 9.0 ).add( vec3( 0.0, uTime.negate().mul( 2.5 ), uTime.mul( 0.7 ) ) ) ).mul( 0.5 ).add( 0.5 );

				const baseEmission = uEmitTemperature.greaterThan( 0.0 ).select( float( 1.0 ), float( 0.0 ) );
				const movementEmission = uEmitterSpeed.mul( uMotionBoost );
				const emissionFactor = baseEmission.add( movementEmission );

				const densityVal = uEmitDensity.mul( float( 1 / 120 ) ).mul( flicker.mul( 0.85 ).add( 0.15 ) ).mul( emissionFactor );

				If( densityVal.greaterThan( 0.0 ), () => {

					const tempVal = uEmitTemperature.mul( float( 1 / 120 ) ).mul( flicker.mul( 0.85 ).add( 0.15 ) ).mul( emissionFactor );

					const currentDye = dyeTexNode.sample( uvw ).level( 0 );
					const newDensity = currentDye.r.add( densityVal );
					const newTemp = currentDye.g.add( tempVal ).clamp( 0.0, 12.0 );

					const currentAge = currentDye.b;
					const newAge = mix( currentAge, float( 0.0 ), densityVal.div( max( newDensity, 0.001 ) ) );

					textureStore( dyeTexWriteNode, coord, vec4( newDensity, newTemp, newAge, 1.0 ) ).toWriteOnly();

				} );

			} );

		} )().compute( vertexCount ).setName( 'emitEmitter' );

	}

	function applyMoodBlend( from, to, blendT ) {

		blendMoodIntoColors(
			uFireStartColor.value,
			uFireMidColor.value,
			uFireEndColor.value,
			from,
			to,
			blendT,
		);

		const scalars = blendMoodScalars( from, to, blendT );

		params.simSpeed = scalars.simSpeed;
		params.turbulence = scalars.turbulence;
		params.fireLifespan = scalars.fireLifespan;
		params.smokeLifespan = scalars.smokeLifespan;

		uFireIntensity.value = scalars.fireIntensity;
		uEmitTemperature.value = scalars.emitTemperature;
		uEmitDensity.value = scalars.emitDensity;
		uBuoyancy.value = scalars.buoyancy;
		uFireHue.value = THREE.MathUtils.degToRad( scalars.fireHue );

		if ( bloomPass ) {

			bloomPass.strength.value = scalars.bloomStrength;

		}

	}

	function updateTemporalUniforms( time ) {

		uTime.value = time % 1000;

		const heightNoise = cpuNoise.noise( 0, time * 2.5, 0 );
		uFlameHeight.value = 5.2 + heightNoise * 1.1;

		const swayX = cpuNoise.noise( time * 3.5, 0, 0 ) * 0.4;
		const swayZ = cpuNoise.noise( 0, 0, time * 3.5 ) * 0.4;
		uSway.value.set( swayX, 0, swayZ );

		const slowNoise = cpuNoise.noise( 0, time * 0.8, 0 );
		const fastNoise = cpuNoise.noise( 0, time * 15.0, 0 );
		uFlicker.value = slowNoise * 0.12 + fastNoise * 0.06 + 0.82;

		uColorNoise.value = cpuNoise.noise( time * 5.0, time * 5.0, 0 ) * 0.08;

		emitter.rotation.y = time * 0.25;
		emitter.updateMatrixWorld();
		uEmitterMatrix.value.copy( emitter.matrixWorld );

	}

	function updateCameraFraming() {

		const aspect = window.innerWidth / Math.max( window.innerHeight, 1 );
		cameraDistance = aspect > 1.35 ? 22 : aspect < 0.75 ? 17 : 19.5;
		camera.fov = aspect > 1.5 ? 52 : 58;
		camera.updateProjectionMatrix();

	}

	function updateCameraDrift( time ) {

		camera.position.set(
			cameraBase.x + Math.sin( time * 0.1 ) * 0.25,
			cameraBase.y + Math.sin( time * 0.07 ) * 0.12,
			cameraDistance + Math.cos( time * 0.08 ) * 0.35,
		);
		camera.lookAt( cameraTarget );

	}

	function animate() {

		const currentTime = performance.now();
		const delta = Math.min( ( currentTime - lastTime ) * 0.001, 1 / 30 );
		lastTime = currentTime;

		const moodElapsed = currentTime - moodStartTime;
		const moodIndex = Math.floor( moodElapsed / MOOD_CYCLE_MS ) % FIRE_MOODS.length;
		const nextMoodIndex = ( moodIndex + 1 ) % FIRE_MOODS.length;
		const timeInCycle = moodElapsed % MOOD_CYCLE_MS;
		let moodBlend = 0;

		if ( timeInCycle > MOOD_CYCLE_MS - MOOD_BLEND_MS ) {

			moodBlend = ( timeInCycle - ( MOOD_CYCLE_MS - MOOD_BLEND_MS ) ) / MOOD_BLEND_MS;

		}

		applyMoodBlend( FIRE_MOODS[ moodIndex ], FIRE_MOODS[ nextMoodIndex ], moodBlend );

		const currentPos = emitter.position;
		const dist = currentPos.distanceTo( prevEmitterPos );
		const speed = delta > 0 ? dist / delta : 0;

		const emitterVel = new THREE.Vector3();
		if ( delta > 0 ) {

			emitterVel.subVectors( currentPos, prevEmitterPos ).multiplyScalar( 1 / delta );

		}

		prevEmitterPos.copy( currentPos );

		uEmitterSpeed.value = speed;
		uEmitterVelocity.value.copy( emitterVel );
		uEmitterPosition.value.copy( currentPos );

		updateCameraDrift( simulationTime );

		if ( params.simSpeed > 0 ) {

			const dt = delta * params.simSpeed;
			simAccumulator += dt;

			const stepTime = 1 / 120;
			const simStep = stepTime * params.simSpeed;

			const maxAccumulator = simStep * 8;
			if ( simAccumulator > maxAccumulator ) {

				simAccumulator = maxAccumulator;

			}

			uDt.value = simStep;
			uTurbulence.value = params.turbulence / Math.sqrt( params.simSpeed );

			if ( params.smokeLifespan >= 100.0 ) {

				uDissipation.value = 0.0;

			} else {

				uDissipation.value = 1.0 / params.smokeLifespan;

			}

			uCooling.value = 1.0 / params.fireLifespan;

			while ( simAccumulator >= simStep ) {

				simulationTime += simStep;
				updateTemporalUniforms( simulationTime );

				renderer.compute( advectVelocityPass );
				renderer.compute( divergencePass );

				for ( let i = 0; i < PRESSURE_ITERATIONS; i ++ ) {

					renderer.compute( ( i % 2 === 0 ) ? jacobiPassAB : jacobiPassBA );

				}

				renderer.compute( projectPass );
				renderer.compute( advectDyePass );
				renderer.compute( emitEmitterPass );

				const temp = dyeTexNode.value;
				dyeTexNode.value = dyeTexWriteNode.value;
				dyeTexWriteNode.value = temp;

				simAccumulator -= simStep;

			}

		} else {

			updateTemporalUniforms( simulationTime );

		}

		const tempRatio = uEmitTemperature.value / 8.34;
		const densityRatio = uEmitDensity.value / 11.02;
		const intensityRatio = uFireIntensity.value / 5.63;
		const sizeFactor = Math.sqrt( tempRatio * densityRatio * intensityRatio );

		const fadeT = Math.min( Math.max( simulationTime / 3.0, 0.0 ), 1.0 );
		const fadeIn = fadeT * fadeT * ( 3.0 - 2.0 * fadeT );

		pointLight.distance = Math.max( 0.01, 40.0 * Math.max( 0.2, sizeFactor ) * fadeIn );

		renderPipeline.render();

	}

	function onWindowResize() {

		camera.aspect = window.innerWidth / window.innerHeight;
		updateCameraFraming();
		renderer.setSize( window.innerWidth, window.innerHeight );

	}

	renderer = new THREE.WebGPURenderer( { antialias: true } );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 2.65;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.transmitted = true;
	container.appendChild( renderer.domElement );

	await renderer.init();

	scene = new THREE.Scene();
	scene.background = new THREE.Color( VOID_BACKGROUND );

	camera = new THREE.PerspectiveCamera( 56, window.innerWidth / window.innerHeight, 0.1, 120 );
	updateCameraFraming();
	camera.position.set( cameraBase.x, cameraBase.y, cameraDistance );
	camera.lookAt( cameraTarget );

	velTexA = createStorage3D( 'velocity A' );
	velTexB = createStorage3D( 'velocity B' );
	dyeTexA = createStorage3D( 'dye A' );
	dyeTexB = createStorage3D( 'dye B' );
	divTex = createStorage3D( 'divergence' );
	pressTexA = createStorage3D( 'pressure A' );
	pressTexB = createStorage3D( 'pressure B' );
	curlNoiseTex = createStorage3D( 'curlNoise' );
	curlNoiseTex.wrapS = THREE.RepeatWrapping;
	curlNoiseTex.wrapT = THREE.RepeatWrapping;
	curlNoiseTex.wrapR = THREE.RepeatWrapping;

	dyeTexNode = texture3D( dyeTexA );
	dyeTexWriteNode = storageTexture( dyeTexB ).toWriteOnly();
	curlNoiseTexNode = texture3D( curlNoiseTex );

	const emitterGeometry = new THREE.CylinderGeometry( 0.45, 0.65, 0.9, 32, 6 );
	emitterGeometry.computeBoundingBox();
	const emitterMinY = emitterGeometry.boundingBox.min.y;
	vertexCount = emitterGeometry.attributes.position.count;
	emitterVerticesBuffer = storage( emitterGeometry.attributes.position, 'vec3', vertexCount ).toReadOnly();

	createComputePasses();
	await renderer.computeAsync( computeCurlNoisePass );

	const fireRamp = Fn( ( [ t ] ) => {

		const color = vec3( 0 ).toVar();
		color.assign( mix( vec3( 0.0, 0.0, 0.0 ), uFireEndColor, smoothstep( 0.05, 0.35, t ) ) );
		color.assign( mix( color, uFireMidColor, smoothstep( 0.35, 0.65, t ) ) );
		color.assign( mix( color, uFireStartColor, smoothstep( 0.65, 1.0, t ) ) );

		return color;

	} );

	const henyeyGreenstein = Fn( ( [ cosTheta, g ] ) => {

		const g2 = g.mul( g );
		const denom = float( 1.0 ).add( g2 ).sub( float( 2.0 ).mul( g ).mul( cosTheta ) );
		const oneMinusG2 = float( 1.0 ).sub( g2 );

		return oneMinusG2.div( denom.pow( 1.5 ) ).mul( 0.079577 );

	} );

	const getVolumeSample = ( { positionRay } ) => {

		const uvw = positionRay.sub( vec3( 0, VOLUME_WORLD_SIZE_Y / 2, 0 ) ).div( uVolumeWorldSize ).add( 0.5 ).toVar();

		const noiseDistortion = texture3D( velTexA, uvw, 0 ).xyz.div( uVolumeWorldSize ).mul( 0.15 );
		const distortedUVW = uvw.add( noiseDistortion ).clamp( 0.0, 1.0 ).toVar();

		const sample = dyeTexNode.sample( distortedUVW ).level( 0 );

		const density = sample.r;
		const age = sample.b;
		const temperature = sample.g;

		const detailNoise = snoise( positionRay.mul( 5.5 ).add( vec3( 0, age.mul( 0.8 ).negate(), 0 ) ) );
		density.mulAssign( detailNoise.mul( 0.35 ).add( 0.85 ) );

		const edge = min( distortedUVW, vec3( 1 ).sub( distortedUVW ) );
		density.mulAssign( smoothstep( 0.0, 0.06, min( edge.x, min( edge.y, edge.z ) ) ) );

		return { density, temperature, age, distortedUVW };

	};

	const volumetricMaterial = new THREE.VolumeNodeMaterial();
	volumetricMaterial.steps = 22;
	volumetricMaterial.transparent = true;
	volumetricMaterial.blending = THREE.AdditiveBlending;
	volumetricMaterial.depthWrite = false;
	volumetricMaterial.offsetNode = fract( interleavedGradientNoise( screenCoordinate ).add( float( frameId ).mul( 0.618033988749895 ) ) );

	volumetricMaterial.scatteringNode = Fn( ( { positionRay } ) => {

		const { density } = getVolumeSample( { positionRay } );

		const lightDir = uKeyLightPos.sub( positionRay ).normalize();
		const shadowDensitySum = float( 0.0 ).toVar();
		const shadowStepSize = 0.35;

		for ( let i = 0; i < 2; i ++ ) {

			const stepDist = ( i + 0.5 ) * shadowStepSize;
			const shadowPos = positionRay.add( lightDir.mul( stepDist ) );
			const shadowUVW = shadowPos.sub( vec3( 0, VOLUME_WORLD_SIZE_Y / 2, 0 ) ).div( uVolumeWorldSize ).add( 0.5 );

			const shadowEdge = min( shadowUVW, vec3( 1 ).sub( shadowUVW ) );
			const shadowFade = smoothstep( 0.0, 0.06, min( shadowEdge.x, min( shadowEdge.y, shadowEdge.z ) ) );

			const shadowSample = texture3D( dyeTexA, shadowUVW, 0 ).r.mul( shadowFade );
			shadowDensitySum.addAssign( shadowSample );

		}

		const tau = shadowDensitySum.mul( shadowStepSize ).mul( uShadowAbsorption );
		const beer = tau.negate().exp();
		const multiScatter = tau.mul( 0.25 ).negate().exp().mul( 0.5 );
		const baseTransmittance = mix( beer, beer.add( multiScatter ), uMultiScattering );
		const powder = float( 1.0 ).sub( tau.mul( 2.0 ).negate().exp() );
		const finalTransmittance = mix( baseTransmittance, baseTransmittance.mul( powder ), uPowderStrength );
		const lightTransmittance = finalTransmittance.add( uShadowAmbient ).clamp( 0.0, 1.0 );

		const viewDir = cameraPosition.sub( positionRay ).normalize();
		const cosTheta = viewDir.dot( lightDir ).clamp( - 1.0, 1.0 );
		const phase = henyeyGreenstein( cosTheta, uAsymmetry );

		const smokeScattering = vec3( density ).mul( lightTransmittance ).mul( phase.mul( 12.56637 ) );

		return smokeScattering;

	} );

	volumetricMaterial.scatteringEmissiveNode = Fn( ( { positionRay } ) => {

		const { density, temperature } = getVolumeSample( { positionRay } );

		const firePower = float( 6.0 ).sub( uFireGlowSpread );
		const fire = fireRamp( temperature.clamp( 0, 1 ) ).mul( temperature.pow( firePower ) ).mul( uFireIntensity );
		const fireColor = hue( fire, uFireHue );

		const distance = positionRay.sub( uKeyLightPos ).length();
		const attenuation = float( 400.0 ).div( distance.pow( 2.0 ) );

		return fireColor.mul( density.add( 0.15 ) ).mul( attenuation );

	} );

	const volumeCastShadow = Fn( () => {

		const startPos = positionWorld;
		const lightDir = positionWorld.sub( cameraPosition ).normalize();

		const steps = uniform( 'int' ).onRenderUpdate( ( { material, object } ) => material.steps || ( object && object.material && object.material.steps ) || volumetricMaterial.steps );
		const maxDistance = float( VOLUME_WORLD_SIZE_DIAGONAL );
		const stepSize = maxDistance.div( steps ).toVar();
		const rayDir = lightDir.toVar();

		const distTravelled = float( 0.0 ).toVar();
		const transmittance = float( 1.0 ).toVar();

		Loop( steps, () => {

			const positionRay = startPos.add( rayDir.mul( distTravelled ) );
			const { density } = getVolumeSample( { positionRay } );

			const absorption = density.mul( uShadowAbsorption ).mul( 0.01 );
			const falloff = absorption.negate().mul( stepSize ).exp();

			transmittance.mulAssign( falloff );
			distTravelled.addAssign( stepSize );

		} );

		transmittance.greaterThanEqual( 0.99 ).discard();

		const shadowOpacity = transmittance.oneMinus();

		return vec4( vec3( 0 ), shadowOpacity.mul( 5 ) );

	} );

	volumetricMesh = new THREE.Mesh(
		new THREE.BoxGeometry( VOLUME_WORLD_SIZE_X, VOLUME_WORLD_SIZE_Y, VOLUME_WORLD_SIZE_Z ),
		volumetricMaterial,
	);
	volumetricMesh.position.y = VOLUME_WORLD_SIZE_Y / 2 + 0.4;
	volumetricMesh.scale.copy( VOLUME_SCALE );
	volumetricMesh.receiveShadow = true;
	scene.add( volumetricMesh );

	const shadowMaterial = new THREE.VolumeNodeMaterial();
	shadowMaterial.steps = volumetricMaterial.steps;
	shadowMaterial.offsetNode = volumetricMaterial.offsetNode;
	shadowMaterial.castShadowNode = volumeCastShadow();
	shadowMaterial.shadowSide = THREE.FrontSide;
	shadowMaterial.colorWrite = false;
	shadowMaterial.depthWrite = false;
	shadowMaterial.blending = THREE.CustomBlending;
	shadowMaterial.blendEquation = THREE.AddEquation;
	shadowMaterial.blendSrc = THREE.ZeroFactor;
	shadowMaterial.blendDst = THREE.OneMinusSrcAlphaFactor;
	shadowMaterial.blendEquationAlpha = THREE.AddEquation;
	shadowMaterial.blendSrcAlpha = THREE.OneFactor;
	shadowMaterial.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;

	const volumetricShadowMesh = new THREE.Mesh(
		new THREE.BoxGeometry( VOLUME_WORLD_SIZE_X, VOLUME_WORLD_SIZE_Y, VOLUME_WORLD_SIZE_Z ),
		shadowMaterial,
	);
	volumetricShadowMesh.position.y = VOLUME_WORLD_SIZE_Y / 2 + 0.4;
	volumetricShadowMesh.scale.copy( volumetricMesh.scale );
	volumetricShadowMesh.castShadow = true;
	scene.add( volumetricShadowMesh );

	emitter = new THREE.Mesh(
		emitterGeometry,
		new THREE.MeshStandardMaterial( { color: 0x000000, roughness: 1.0, metalness: 1.0 } ),
	);
	const volumeFloorY = 0.4;
	emitter.position.set( 0, volumeFloorY - emitterMinY, 0 );
	emitter.visible = false;
	emitter.receiveShadow = false;
	scene.add( emitter );

	prevEmitterPos.copy( emitter.position );
	emitter.updateMatrixWorld();
	uEmitterMatrix.value.copy( emitter.matrixWorld );
	uEmitterPosition.value.copy( emitter.position );

	const isVolume = Fn( ( { material } ) => {

		const isVolumeMaterial = material && material.isVolumeNodeMaterial;

		return float( isVolumeMaterial ? 1.0 : 0.0 );

	} )();

	const pointLightColor = Fn( () => {

		const P = positionWorld;
		const A = uEmitterPosition;
		const H = vec3( 0.0, uFlameHeight, 0.0 );

		const V = P.sub( A );
		const t = V.dot( H ).div( H.dot( H ) ).clamp( 0.0, 1.0 );
		const C = A.add( uSway ).add( H.mul( t ) );
		const distToSegment = P.sub( C ).length();

		const r = float( 1.2 );
		const softAttenuation = float( 1.0 ).div( distToSegment.pow( 2.0 ).add( r.pow( 2.0 ) ) );

		const distToLight = P.sub( A ).length();
		const decayExponent = float( 2.0 );
		const defaultAttenuation = distToLight.pow( decayExponent ).max( 0.01 ).reciprocal();

		const attenuationCorrection = isVolume.equal( 1.0 ).select(
			softAttenuation.div( defaultAttenuation ),
			float( 1.0 ),
		);

		const currentIntensity = isVolume.equal( 1.0 ).select( uPointLightVolumeIntensity, uPointLightSurfaceIntensity );

		const colorT = uEmitTemperature.div( 8.34 ).mul( 0.5 ).add( 0.20 ).add( uColorNoise ).clamp( 0.0, 1.0 );
		const fireColor = fireRamp( colorT );
		const coloredFire = hue( saturation( fireColor, uSaturation ), uFireHue );

		const relP = P.xz.sub( A.xz );
		const angle = atan( relP.y, relP.x );
		const distXZ = relP.length();

		const freqScale = uPointLightProjectionFrequency;
		const angleNoise = mx_noise_float( vec3( cos( angle ).mul( float( 1.5 ).mul( freqScale ) ), sin( angle ).mul( float( 1.5 ).mul( freqScale ) ), uTime.mul( 0.6 ) ) ).mul( 0.5 ).add( 0.5 );
		const centerFadeFactor = smoothstep( 0.0, uPointLightProjectionCenterFade, distXZ );
		const cleanAngleNoise = mix( float( 1.0 ), angleNoise, centerFadeFactor );

		const noiseCoord1 = vec3( P.x.mul( float( 0.6 ).mul( freqScale ) ), uTime.mul( 1.2 ), P.z.mul( float( 0.6 ).mul( freqScale ) ) );
		const projN1 = mx_noise_float( noiseCoord1 ).mul( 0.5 ).add( 0.5 );

		const noiseCoord2 = vec3( P.x.mul( float( 1.5 ).mul( freqScale ) ), uTime.mul( 2.5 ), P.z.mul( float( 1.5 ).mul( freqScale ) ) );
		const projN2 = mx_noise_float( noiseCoord2 ).mul( 0.5 ).add( 0.5 );

		const projNoise = projN1.mul( 0.65 ).add( projN2.mul( 0.35 ) );
		const projectionIntensity = projNoise.mul( cleanAngleNoise.mul( 0.5 ).add( 0.5 ) );

		const noiseFadeFactor = distToSegment.div( uPointLightProjectionNoiseFade ).clamp( 0.0, 1.0 );
		const finalIntensity = mix( projectionIntensity, float( 1.0 ), noiseFadeFactor );

		const radialTemp = float( 1.0 ).sub( distToSegment.div( uPointLightProjectionRadius ) ).clamp( 0.0, 1.0 );
		const colorTProj = radialTemp.mul( finalIntensity ).clamp( 0.0, 1.0 );
		const fireColorProj = fireRamp( colorTProj );
		const coloredFireProj = hue( saturation( fireColorProj, uSaturation ), uFireHue );

		const finalFireColor = isVolume.equal( 1.0 ).select( coloredFire, coloredFireProj );

		const tempScale = uEmitTemperature.div( 8.34 ).max( 0.0 );
		const tempFactor = tempScale.pow( 4.0 );
		const densityScale = uEmitDensity.div( 11.02 ).max( 0.0 );
		const fadeIn = smoothstep( 0.0, 3.0, uTime );

		const baseColor = finalFireColor.mul( tempFactor ).mul( densityScale ).mul( uFireIntensity ).mul( currentIntensity ).mul( uFlicker ).mul( fadeIn );

		const distRatio = distToSegment.div( uLightFarDistance ).clamp( 0.0, 1.0 );
		const distanceScale = mix( uLightNearIntensity, uLightFarIntensity, smoothstep( 0.0, 1.0, distRatio ) );
		const finalScale = isVolume.equal( 1.0 ).select( distanceScale, float( 1.0 ) );

		return baseColor.mul( attenuationCorrection ).mul( finalScale );

	} )();

	pointLight = new THREE.PointLight( 0xffffff, 1, 100, 2 );
	pointLight.colorNode = pointLightColor;
	pointLight.position.set( 0, 0, 0 );
	pointLight.castShadow = false;
	emitter.add( pointLight );

	keyLight = new THREE.SpotLight( 0xffaa66, 420 );
	keyLight.position.set(
		- 3 * ( VOLUME_WORLD_SIZE_X / 8 ),
		6 * ( VOLUME_WORLD_SIZE_Y / 8 ) + VOLUME_WORLD_SIZE_Y / 2 + 0.4,
		3 * ( VOLUME_WORLD_SIZE_Z / 8 ),
	);
	keyLight.angle = Math.PI / 5;
	keyLight.penumbra = 1;
	keyLight.decay = 2;
	keyLight.distance = 0;
	keyLight.castShadow = true;
	keyLight.shadow.intensity = 0.98;
	keyLight.shadow.mapSize.width = 1024;
	keyLight.shadow.mapSize.height = 1024;
	keyLight.shadow.camera.near = 1;
	const maxVolumeSize = Math.max( VOLUME_WORLD_SIZE_X, VOLUME_WORLD_SIZE_Y, VOLUME_WORLD_SIZE_Z );
	keyLight.shadow.camera.far = 20 * ( maxVolumeSize / 8 );
	keyLight.shadow.bias = - 0.001;
	keyLight.shadow.focus = 1;
	keyLight.target.position.set( 1, 0, 0 );
	scene.add( keyLight );
	scene.add( keyLight.target );

	uKeyLightPos = uniform( keyLight.position );

	renderPipeline = new THREE.RenderPipeline( renderer );

	const LAYER_VOLUMETRIC_LIGHTING = 10;
	const volumetricLayer = new THREE.Layers();
	volumetricLayer.disableAll();
	volumetricLayer.enable( LAYER_VOLUMETRIC_LIGHTING );

	volumetricMesh.layers.disableAll();
	volumetricMesh.layers.enable( LAYER_VOLUMETRIC_LIGHTING );

	keyLight.layers.enable( LAYER_VOLUMETRIC_LIGHTING );
	pointLight.layers.enable( LAYER_VOLUMETRIC_LIGHTING );

	const scenePass = pass( scene, camera );
	scenePass.name = 'Scene Pass';

	const volumetricPass = pass( scene, camera );
	volumetricPass.name = 'Volumetric Lighting';
	volumetricPass.setLayers( volumetricLayer );
	volumetricPass.setResolutionScale( VOLUMETRIC_RESOLUTION );

	denoiseStrength = uniform( 0.5 );

	emitter.material.emissiveNode = Fn( () => {

		const p = positionLocal.mul( 0.5 );
		const flow = vec3( 0.0, uTime.negate(), 0.0 );

		const n1 = mx_noise_float( p.add( flow ) ).mul( 0.5 ).add( 0.5 );
		const p2 = p.mul( 2.0 ).sub( flow.mul( 1.5 ) );
		const n2 = mx_noise_float( p2.add( vec3( n1.mul( 0.4 ) ) ) ).mul( 0.5 ).add( 0.5 );
		const p3 = p.mul( 4.0 ).add( flow.mul( 2.5 ) );
		const n3 = mx_noise_float( p3 ).mul( 0.5 ).add( 0.5 );

		const noiseVal = n1.mul( 0.50 ).add( n2.mul( 0.35 ) ).add( n3.mul( 0.15 ) );
		const lavaT = noiseVal.pow( 2.5 ).clamp( 0.0, 1.0 );

		const fireColor = fireRamp( lavaT.add( 0.1 ) );
		const coloredFire = hue( saturation( fireColor, uSaturation ), uFireHue );

		const tempScale = uEmitTemperature.div( 8.34 ).max( 0.0 );
		const tempFactor = tempScale.pow( 4.0 );
		const densityScale = uEmitDensity.div( 11.02 ).max( 0.0 );
		const fadeIn = smoothstep( 0.0, 3.0, uTime );

		return coloredFire.mul( tempFactor ).mul( densityScale ).mul( uFireIntensity ).mul( uFlicker ).mul( fadeIn ).mul( uEmitterEmissiveIntensity );

	} )();

	params = {
		simulate: true,
		simSpeed: FIRE_MOODS[ 0 ].simSpeed,
		smokeLifespan: FIRE_MOODS[ 0 ].smokeLifespan,
		fireLifespan: FIRE_MOODS[ 0 ].fireLifespan,
		turbulence: FIRE_MOODS[ 0 ].turbulence,
	};

	const blurredVolumetricPass = gaussianBlur( volumetricPass, denoiseStrength, 1 );

	const volumetricRGB = blurredVolumetricPass.rgb;
	const adjustedVolumetricRGB = saturation( volumetricRGB, uSaturation );
	const adjustedVolumetric = vec4( adjustedVolumetricRGB, volumetricPass.a ).mul( 1.15 );
	const scenePassColor = scenePass.max( adjustedVolumetric ).add( adjustedVolumetric.mul( 0.65 ) );

	bloomPass = bloom( scenePassColor );
	bloomPass.threshold.value = BLOOM_THRESHOLD;
	bloomPass.strength.value = FIRE_MOODS[ 0 ].bloomStrength;
	bloomPass.radius.value = BLOOM_RADIUS;

	renderPipeline.outputNode = scenePassColor.add( bloomPass );

	window.addEventListener( 'resize', onWindowResize );
	renderer.setAnimationLoop( animate );

	return {
		dispose() {

			renderer.setAnimationLoop( null );
			window.removeEventListener( 'resize', onWindowResize );

			bloomPass?.dispose();

			emitterGeometry.dispose();
			emitter.material.dispose();
			volumetricMesh.geometry.dispose();
			volumetricMaterial.dispose();
			volumetricShadowMesh.geometry.dispose();
			shadowMaterial.dispose();

			velTexA.dispose();
			velTexB.dispose();
			dyeTexA.dispose();
			dyeTexB.dispose();
			divTex.dispose();
			pressTexA.dispose();
			pressTexB.dispose();
			curlNoiseTex.dispose();

			renderer.dispose();
			renderer.domElement.remove();

		},
	};

}
