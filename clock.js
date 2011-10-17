// OpenGL pipeline: http://research.cs.queensu.ca/~jstewart/454/notes/pipeline/
// OpenGL projection matrix: http://www.songho.ca/opengl/gl_projectionmatrix.html
// camera.matrixWorldInverse holds the View matrix
// camera.projectionMatrix is the Projection matrix
// THREE does not expose the viewport so we have to track.

(function() {
  // Monkey-patch Vector3 with some more useful functions.
  THREE.Vector3.add = function(a,b) {
    return new THREE.Vector3(a.x+b.x, a.y+b.y, a.z+b.z);
  };
  THREE.Vector3.sub = function(a,b) {
    return new THREE.Vector3(a.x-b.x, a.y-b.y, a.z-b.z);
  };

  var IDEAL_CUBE_SIZE = 12;

  var camera, scene, renderer;
  var container, stats;

  var viewportWidth, viewportHeight;

  var mouseX = 0, mouseY = 0;

  var gridWidth = 0, gridHeight = 0;
  var gridState = [];

  var digit_one = {
    width: 5, height: 5,
    pixels: [0,0,0,0,1,
             0,0,0,0,1,
             0,0,0,0,1,
             0,0,0,0,1,
             0,0,0,0,1]};
  var digit_two = {
    width: 5, height: 5,
    pixels: [1,1,1,1,1,
             0,0,0,0,1,
             1,1,1,1,1,
             1,0,0,0,0,
             1,1,1,1,1]};
  var digit_three = {
    width: 5, height: 5,
    pixels: [1,1,1,1,1,
             0,0,0,0,1,
             0,0,1,1,1,
             0,0,0,0,1,
             1,1,1,1,1]};
  var digit_four = {
    width: 5, height: 5,
    pixels: [1,0,0,0,1,
             1,0,0,0,1,
             1,1,1,1,1,
             0,0,0,0,1,
             0,0,0,0,1]};
  var digit_five = {
    width: 5, height: 5,
    pixels: [1,1,1,1,1,
             1,0,0,0,0,
             1,1,1,1,1,
             0,0,0,0,1,
             1,1,1,1,1]};
  var digit_six = {
    width: 5, height: 5,
    pixels: [1,1,1,1,1,
             1,0,0,0,0,
             1,1,1,1,1,
             1,0,0,0,1,
             1,1,1,1,1]};
  var digit_seven = {
    width: 5, height: 5,
    pixels: [1,1,1,1,1,
             0,0,0,0,1,
             0,0,0,1,0,
             0,0,1,0,0,
             0,0,1,0,0]};
  var digit_eight = {
    width: 5, height: 5,
    pixels: [0,1,1,1,0,
             1,0,0,0,1,
             0,1,1,1,0,
             1,0,0,0,1,
             0,1,1,1,0]};
  var digit_nine = {
    width: 5, height: 5,
    pixels: [0,1,1,1,0,
             1,0,0,0,1,
             0,1,1,1,1,
             0,0,0,0,1,
             0,0,0,0,1]};
  var digit_zero = {
    width: 5, height: 5,
    pixels: [0,1,1,1,0,
             1,0,0,0,1,
             1,0,0,0,1,
             1,0,0,0,1,
             0,1,1,1,0]};
  var digits = [digit_zero, digit_one, digit_two, digit_three, digit_four, digit_five, digit_six, digit_seven, digit_eight, digit_nine];

  init();
  animate();

  // In world coordinates: +X is right, +Y is up, +Z is towards the camera
  function init() {
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;

    container = document.createElement('div');
    document.body.appendChild(container);

    camera = new THREE.PerspectiveCamera(30, viewportWidth / viewportHeight, 10, 1000);
    camera.position.z = 200;
    scene = new THREE.Scene();

    buildGrid();

    linePoints = new THREE.Geometry();
    var colors = [], color = new THREE.Color(0xffffff);
    // Draw a border around the screen, but specifying points in NDC space that are 20% back in the frustum.
    // We define the points in a clockwise order.
    linePoints.vertices.push(new THREE.Vertex(unProject(camera, -1, 1, 0.2)));
    colors[0] = color;
    linePoints.vertices.push(new THREE.Vertex(unProject(camera, 1, 1, 0.2)));
    colors[1] = color;
    linePoints.vertices.push(new THREE.Vertex(unProject(camera, 1, -1, 0.2)));
    colors[2] = color;
    linePoints.vertices.push(new THREE.Vertex(unProject(camera, -1, -1, 0.2)));
    colors[3] = color;
    linePoints.vertices.push(new THREE.Vertex(unProject(camera, -1, 1, 0.2)));
    colors[4] = color;
    linePoints.colors = colors;
    lineMaterial = new THREE.LineBasicMaterial({color: 0xa0a0a0, opacity: 1, linewidth: 3});
    line = new THREE.Line(linePoints, lineMaterial);
    scene.add(line);

    renderer = new THREE.WebGLRenderer({clearColor: 0x000000, clearAlpha: 1, antialias: false});
    renderer.setSize(viewportWidth, viewportHeight);
    renderer.autoClear = false;
    container.appendChild(renderer.domElement);

    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    container.appendChild(stats.domElement);

    document.addEventListener('mousemove', onMouseMove, false);
  }

  function buildGrid() {
    var t = 0.2;

    var topLeft = unProject(camera, -1, 1, t);
    var topRight = unProject(camera, 1, 1, t);
    var bottomLeft = unProject(camera, -1, -1, t);

    gridWidth = Math.ceil(topLeft.distanceTo(topRight) / IDEAL_CUBE_SIZE);
    gridHeight = Math.ceil(topLeft.distanceTo(bottomLeft) / IDEAL_CUBE_SIZE);
    var cube_width = topLeft.distanceTo(topRight) / gridWidth;
    var cube_height = topLeft.distanceTo(bottomLeft) / gridHeight;
    var cube_depth = (cube_width + cube_height) / 2;

    // Compute the origin of the grid
    var v_gridOrigin = THREE.Vector3.sub(topLeft, new THREE.Vector3(-cube_width/2, cube_height/2, cube_depth/2));
    var material_on = new THREE.MeshPhongMaterial({ambient: 0x101010, color: 0xffffff, specular: 0xffffff, shininess: 50, shading: THREE.SmoothShading});
    var material_off = new THREE.MeshPhongMaterial({ambient: 0x101010, color: 0x0000ff, specular: 0xffffff, shininess: 50, shading: THREE.SmoothShading});
    var geometry = new THREE.CubeGeometry(cube_width, cube_height, cube_depth, undefined, undefined, undefined, [material_off, material_off, material_on, material_on, material_on, material_on]);
    for (var i = 0; i < gridHeight; i++) {
      for (var j = 0; j < gridWidth; j++) {
        var v_cubePosition = THREE.Vector3.add(v_gridOrigin, new THREE.Vector3(j * cube_width, i * -cube_height, 0));

        var mesh = new THREE.Mesh(geometry, new THREE.MeshFaceMaterial());
        mesh.position.copy(v_cubePosition);
        scene.add(mesh);

        var index = i * gridWidth + j;
        gridState[index] = 0;
      }
    }

    light = new THREE.PointLight(0x60d040, 1, 200);
    light.position.z = 100;
    scene.add(light);
  }

  // Project a point in world space into NDC space.
  // In NDC space:
  //   x goes from -1 (left of 'screen') to 1 (right of 'screen').
  //   y goes from -1 (bottom of 'screen') to 1 (top of 'screen').
  //   z (projected depth) goes from -1 (near) to 1 (far).
  function WorldToNDC(camera, worldPoint) {
    // Make sure the camera matrices are update.
    camera.update(undefined, false, null);

    // In view space: +z points out of the screen. Negative z goes into the screen.
    var v_view = camera.matrixWorldInverse.multiplyVector4(v_world);
    var v_projection = camera.projectionMatrix.multiplyVector4(v_view);
    return new THREE.Vector3(v_projection.x / v_projection.w, v_projection.y / v_projection.w, v_projection.z / v_projection.w);
  }

  // t is the normalized linear distance between near and far planes that the original point sits at.
  // 0 = near plane, 1 = far plane.
  // At some point I would like to use projected depth for this.
  function unProject(camera, ndcX, ndcY, t) {
    camera.update(undefined, false, null);
    var ndcToWorld = new THREE.Matrix4();
    ndcToWorld.multiply(camera.matrixWorld, THREE.Matrix4.makeInvert(camera.projectionMatrix));

    // Calculate the transformed point on the near plane, just prior to perspective divide.
    // x & y are self explanatory. z/w = -1 on the near plane, therefore z = -near.
    var v_nearPlane = new THREE.Vector4(ndcX * camera.near, ndcY * camera.near, -camera.near, camera.near);
    var v_nearWorld = ndcToWorld.multiplyVector4(v_nearPlane);

    // Calculate the transformed point on the far plane.
    // z/w = 1 on the far plane, therefore z = far.
    var v_farPlane = new THREE.Vector4(ndcX * camera.far, ndcY * camera.far, camera.far, camera.far);
    var v_farWorld = ndcToWorld.multiplyVector4(v_farPlane);

    // Linearly interpolate between the two points.
    var v_dir = THREE.Vector3.sub(v_farWorld, v_nearWorld).multiplyScalar(t).addSelf(v_nearWorld);
    return v_dir;

    // zc (z in NDC space) is:
    // zc = (-(f+n)/(f-n)*zv - 2fn/(f-n)*wv) / -zv
    // Problem is we have two unknowns, wv & zv.
    // Can we use another component to solve for one? No because other equations introduce other unknowns (xv & yv).
  }

  // Convert viewport pixels into world units for a linear distance down the frustum.
  function pixelsToWorldUnits(camera, ndcWidth, ndcHeight, t) {
    var v_start = unProject(camera, -1, -1, t);
    var v_results = new THREE.Vector2(undefined, undefined);
    if (ndcWidth) {
      // Viewport transform:
      // xs = 0.5 * (xc + 1) * (R - L) + L
      // Re-arranging for xc:
      // xc = (2 * (xs - L) / (R - L)) - 1
      // For us currently L is 0 and R - L is viewportWidth,
      // xc = ((2 * xs) / viewportWidth) - 1
      var xc = (2 * ndcWidth) / viewportWidth - 1;
      var v_widthEnd = unProject(camera, xc, -1, t);
      v_results.x = v_widthEnd.distanceTo(v_start);
    }
    if (ndcHeight) {
      // Viewport transform:
      // ys = 0.5 * (yc + 1) * (T - B) + B
      // yc = (2 * (ys - B) / (T - B)) - 1
      //    = ((2 * ys) / viewportHeight) - 1
      var yc = (2 * ndcHeight) / viewportHeight - 1;
      var v_heightEnd = unProject(camera, -1, yc, t);
      v_results.y = v_heightEnd.distanceTo(v_start);
    }

    return v_results;
  }

  function onMouseMove(event) {
    mouseX = event.clientX - viewportWidth / 2;
    mouseY = event.clientY - viewportHeight / 2;
  }

  function setDigit(xPosition, yPosition, digit, on) {
    for (var i = 0; i < digit.width; i++) {
      for (var j = 0; j < digit.height; j++) {
        var gridIndex = (yPosition + i) * gridWidth + j + xPosition;
        var digitIndex = i * digit.width + j;
        if (digit.pixels[digitIndex]) {
          gridState[gridIndex] = on;
        }
      }
    }
  }

  var oldSeconds = null;

  function animate() {
    var now = new Date();
    var seconds = now.getSeconds() % 10;
    if (seconds != oldSeconds) {
      if (oldSeconds != null) {
        setDigit(4, 2, digits[oldSeconds], false);
      }
      setDigit(4, 2, digits[seconds], true);
      oldSeconds = seconds;
    }

    for (var i = 0; i < gridHeight ; i++) {
      for (var j = 0; j < gridWidth ; j++) {
        var index = i * gridWidth + j;
        scene.objects[index].rotation.y = (gridState[index] == 0) ? 0 : Math.PI/2;
      }
    }

    camera.position.x += (mouseX - camera.position.x);
    camera.position.y += (mouseY - camera.position.y);

    requestAnimationFrame(animate);
    render();
    stats.update();
  }

  function render() {
    renderer.clear();
    renderer.render(scene, camera);
  }
})();