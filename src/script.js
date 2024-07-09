import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader.js';
import {Water} from './Water.js';

/**
 * Models
 */
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

gltfLoader.load(
    '/models/pitch/compressed.glb',
    (gltf) => {
      scene.add(gltf.scene);
    },
);

/**
 * Base
 */
// Debug

// Canvas
const canvas = document.querySelector('canvas.webgl');

// Scene
const scene = new THREE.Scene();

/**
 * Lights
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 2.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(1024, 1024);
directionalLight.shadow.camera.far = 15;
directionalLight.shadow.camera.left = -7;
directionalLight.shadow.camera.top = 7;
directionalLight.shadow.camera.right = 7;
directionalLight.shadow.camera.bottom = -7;
scene.add(directionalLight);

/**
 * Sizes
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

window.addEventListener('resize', () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  // Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1,
    100);
scene.add(camera);
const cubeMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5),
    new THREE.MeshBasicMaterial({color: '#ff0000'}),
);
let water = null;

/**
 * Water Shader
 */
const waterGeometry = new THREE.PlaneGeometry(2, 3);

water = new Water(
    waterGeometry,
    {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: new THREE.TextureLoader().load('textures/waternormals.jpg',
          function(texture) {

            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

          }),
      sunDirection: new THREE.Vector3(),
      sunColor: 0x001e0f,
      waterColor: "#11c8ea",
      distortionScale: 3.7,
      fog: scene.fog !== undefined,
    },
);

water.rotation.x = -Math.PI / 2;
water.position.x = 1
water.position.z = 3
water.position.y = 0.32
scene.add(water);

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
/**
 * Contorls
 */

const moveSpeed = 0.05;
const mouseSensitivity = 0.002;

const keys = {
  KeyW: false,
  KeyS: false,
  KeyA: false,
  KeyD: false,
  Space: false,
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
};

document.addEventListener('keydown', (event) => {
  if (event.code in keys) {
    keys[event.code] = true;
  }
});

document.addEventListener('keyup', (event) => {
  if (event.code in keys) {
    keys[event.code] = false;
  }
});

let mouseX = 0;
let mouseY = 0;

document.addEventListener('mousemove', (event) => {
  mouseX -= event.movementX * mouseSensitivity;
  mouseY -= event.movementY * mouseSensitivity;

  // Ограничиваем вертикальный поворот камеры
  mouseY = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, mouseY));
});

// Обработчик клика на canvas
canvas.addEventListener('click', () => {
  canvas.requestPointerLock();
});

/**
 * Animate
 */
const clock = new THREE.Clock();
let previousTime = 0;
const raycaster = new THREE.Raycaster();
let previousIntersectsDistance = null;
const CAMERA_HEIGHT = 1; // Желаемая высота камеры над поверхностью
const MAX_STEP_HEIGHT = 0.5; // Максимальная высота "ступеньки", которую может преодолеть камера

const tick = () => {
  const elapsedTime = clock.getElapsedTime();
  const deltaTime = elapsedTime - previousTime;
  previousTime = elapsedTime;

  water.material.uniforms[ 'time' ].value += 1.0 / 1000.0;

  // // Обновление поворота камеры
  camera.rotation.order = 'YXZ';
  camera.rotation.y = mouseX;
  camera.rotation.x = mouseY;

  // Обновление позиции камеры
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);

  // Проецируем направление камеры на горизонтальную плоскость
  cameraDirection.y = 0;
  cameraDirection.normalize();
  const cameraRight = new THREE.Vector3(-cameraDirection.z, 0,
      cameraDirection.x).normalize();

  if (keys.KeyW || keys.ArrowUp) {
    camera.position.addScaledVector(cameraDirection, moveSpeed);
  }
  if (keys.KeyS || keys.ArrowDown) {
    camera.position.addScaledVector(cameraDirection, -moveSpeed);
  }
  if (keys.KeyA || keys.ArrowLeft) {
    camera.position.addScaledVector(cameraRight, -moveSpeed);
  }
  if (keys.KeyD || keys.ArrowRight) {
    camera.position.addScaledVector(cameraRight, moveSpeed);
  }
  // Корректировка высоты камеры
  raycaster.set(camera.position, new THREE.Vector3(0, -1, 0));
  const intersects = raycaster.intersectObject(scene, true);

  if (intersects.length > 0) {
    const intersectsDistance = intersects[0].distance;

    // Вычисляем желаемую высоту камеры
    const desiredHeight = intersects[0].point.y + CAMERA_HEIGHT;

    // Ограничиваем изменение высоты, чтобы избежать резких скачков
    const maxChange = MAX_STEP_HEIGHT * 0.010 / 0.01; // Масштабируем с учетом скорости движения
    const smoothedHeight = Math.max(
        camera.position.y - maxChange,
        Math.min(camera.position.y + maxChange, desiredHeight),
    );

    // Устанавливаем новую высоту камеры
    camera.position.y = smoothedHeight;

    if (intersectsDistance !== previousIntersectsDistance) {
      previousIntersectsDistance = intersectsDistance;
    }
  } else {
    camera.position.set(2, 2, 2);

  }
  // Update controls
  // controls.update();

  // Render
  renderer.render(scene, camera);

  // Call tick again on the next frame
  window.requestAnimationFrame(tick);
};

tick();