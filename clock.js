// OpenGL pipeline: http://research.cs.queensu.ca/~jstewart/454/notes/pipeline/
// OpenGL projection matrix: http://www.songho.ca/opengl/gl_projectionmatrix.html
// camera.matrixWorldInverse holds the View matrix
// camera.projectionMatrix is the Projection matrix
// THREE does not expose the viewport so we have to track.

(function() {
  var camera, scene, renderer,
  geometry, material, mesh;

  var viewportWidth, viewportHeight;

  var mouseX = 0, mouseY = 0;

  var windowHalfX = window.innerWidth / 2;
  var windowHalfY = window.innerHeight / 2;

  init();
  animate();

  // In world coordinates: +X is right, +Y is up, +Z is towards the camera
  function init() {
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;

    camera = new THREE.PerspectiveCamera(75, viewportWidth / viewportHeight, 10, 1000);
    camera.position.z = 200;
    scene = new THREE.Scene();

    geometry = new THREE.CubeGeometry(50, 50, 50);
    material = new THREE.MeshBasicMaterial({color: 0xff0000, wireframe: true});

    mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = -50;
    scene.add(mesh);

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

    document.body.appendChild(renderer.domElement);

    document.addEventListener('mousemove', onMouseMove, false);
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
    var v_dir = new THREE.Vector3();
    v_dir.sub(v_farWorld, v_nearWorld).multiplyScalar(t).addSelf(v_nearWorld);
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
    mouseX = event.clientX - windowHalfX;
    mouseY = event.clientY - windowHalfY;
  }

  function animate() {
    var time = new Date().getTime() * 0.0005;
    scene.objects[0].rotation.y = time;

    camera.position.x += (mouseX - camera.position.x);
    camera.position.y += (mouseY - camera.position.y);

    requestAnimationFrame(animate);
    render();
  }

  function render() {
    renderer.clear();
    renderer.render(scene, camera);
  }
})();