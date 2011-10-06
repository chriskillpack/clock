(function() {
  var camera, scene, renderer,
  geometry, material, mesh;

  init();
  animate();

  function init() {
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.z = 1000;

    scene = new THREE.Scene();

    geometry = new THREE.CubeGeometry(200, 200, 200);
    material = new THREE.MeshBasicMaterial({color: 0xff0000, wireframe: true});

    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    renderer = new THREE.WebGLRenderer({clearColor: 0x000000, clearAlpha: 1, antialias: false});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.autoClear = false;

    document.body.appendChild(renderer.domElement);
  }

  function animate() {
    var time = new Date().getTime() * 0.0005;
    scene.objects[0].rotation.y = time;

    requestAnimationFrame(animate);
    render();
  }

  function render() {
    renderer.clear();
    renderer.render(scene, camera);
  }
})();