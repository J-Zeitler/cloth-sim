var Vec2 = function (x, y) {
  this.x = x || 0;
  this.y = y || 0;

  this.getDistTo = function (coord) {
    var diffX = coord.x - this.x;
    var diffY = coord.y - this.y;
    return Math.sqrt(diffX*diffX + diffY*diffY);
  };
  this.getLength = function () {
    return Math.sqrt(this.x*this.x + this.y*this.y);
  };
  this.getNormalized = function () {
    var l = this.getLength();
    return new Vec2(this.x/l, this.y/l);
  };
  this.minus = function (coord) {
    return new Vec2(this.x - coord.x, this.y - coord.y);
  };
  this.plus = function (coord) {
    return new Vec2(this.x + coord.x, this.y + coord.y);
  };
  this.mult = function (s) {
    return new Vec2(this.x*s, this.y*s);
  };
};

/**
 * Cloth Node
 */
var Node = function (x, y, immovable) {
  this.pos = new Vec2(x, y);
  this.velocity = new Vec2(0, 0);
  this.immovable = immovable || false;

  this.applyForce = function (F, dt) {
    if (!immovable) {
      var fScaled = F.mult(dt);
      this.velocity = this.velocity.plus(fScaled);
      this.pos = this.pos.plus(this.velocity);
    }
  };
};

var Spring = function (nodeA, nodeB, l, k) {
  if (!nodeA || !nodeB) throw "Spring ctor: A spring needs two Nodes as endpoints.";
  this.nodeA = nodeA;
  this.nodeB = nodeB;
  this.restLength = l || 1;
  this.k = k || 1;

  this.resolve = function (dt) {
    var a = nodeA.pos;
    var b = nodeB.pos;
    var currentLength = a.getDistTo(b);
    var forceMag = this.k*(1 - this.restLength/currentLength);
    var forceDir = b.minus(a).getNormalized();
    var F = forceDir.mult(forceMag);

    this.nodeA.applyForce(F, dt);
    this.nodeB.applyForce(F, -dt);
  };
};

/**
 * Cloth Mesh
 */
var Mesh = function (opts) {

  this.init = function () {
    var o = opts || {};

    this.nodes = [];
    this.springs = [];

    this.anchor = o.anchor || new Vec2(10, 10);
    this.width = o.width || 10;
    this.height = o.height || 10;
    this.scale = o.scale || 50;
    this.stiffness = o.stiffness || 0.002;

    this.initNodes();
    this.initConstraints();
  };

  this.getNode = function (i, j) {
    return this.nodes[j*this.width + i];
  };

  this.initNodes = function () {
    this.nodes = [];
    for (var j = 0; j < this.height; j++) {
      for (var i = 0; i < this.width; i++) {
        this.nodes.push(new Node(
          this.anchor.x + i*this.scale,
          this.anchor.y + j*this.scale
        ));
      }
    }
  };

  this.initConstraints = function () {
    this.springs = [];

    // Structural constraints
    for (var j = 0; j < this.height - 1; j++) {
      for (var i = 0; i < this.width; i++) {
        var node = this.getNode(i, j);
        var down = this.getNode(i, j + 1);
        this.springs.push(new Spring(node, down, this.scale, this.stiffness));
      }
    }
    for (var j = 0; j < this.height; j++) {
      for (var i = 0; i < this.width - 1; i++) {
        var node = this.getNode(i, j);
        var right = this.getNode(i + 1, j);
        this.springs.push(new Spring(node, right, this.scale, this.stiffness));
      }
    }

    // Shear constraints
    for (var j = 0; j < this.height - 1; j++) {
      for (var i = 0; i < this.width - 1; i++) {
        var node = this.getNode(i, j);
        var downRight = this.getNode(i + 1, j + 1);
        this.springs.push(new Spring(node, downRight, this.scale, this.stiffness));
      }
    }
    for (var j = 1; j < this.height; j++) {
      for (var i = 0; i < this.width - 1; i++) {
        var node = this.getNode(i, j);
        var upLeft = this.getNode(i + 1, j - 1);
        this.springs.push(new Spring(node, upLeft, this.scale, this.stiffness));
      }
    }
  };

  this.simulate = function (dt) {
    this.springs.forEach(function (s) {
      s.resolve(dt);
    });
  };

  this.getClosestNode = function (coord) {
    var i = Math.round((coord.x - this.anchor.x)/this.scale);
    var j = Math.round((coord.y - this.anchor.y)/this.scale);

    return this.getNode(i, j) || false;
  };

  this.draw = function (ctx) {
    // draw nodes
    this.nodes.forEach(function (n) {
      ctx.beginPath();
      ctx.arc(n.pos.x, n.pos.y, 1, 0, 2*Math.PI);
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // draw springs
    this.springs.forEach(function (s) {
      var a = s.nodeA;
      var b = s.nodeB;

      ctx.beginPath();
      ctx.moveTo(a.pos.x, a.pos.y);
      ctx.lineTo(b.pos.x, b.pos.y);
      ctx.lineWidth = 0.3;
      ctx.stroke();
    });
  };

  this.init();
};

/**
 * Test
 */
var canvas = document.createElement('canvas');
document.body.appendChild(canvas);

var ctx = canvas.getContext('2d');

var m = new Mesh({
  width: 20,
  height: 20,
  scale: 20,
  anchor: new Vec2(20, 20)
});

var DragAdapter = function (canvas, mesh) {
  this.canvas = canvas;
  this.draggedNode = false;
  this.mesh = mesh;

  this.onDrag = function (e) {
    if (this.draggedNode) {
      this.draggedNode.pos = new Vec2(e.clientX, e.clientY);
    }
  }

  this.canvas.addEventListener("mousemove", function (e) {
    e.preventDefault();
    this.onDrag(e);
  }.bind(this), false);

  this.canvas.addEventListener("mousedown", function (e) {
    e.preventDefault();
    this.draggedNode = this.mesh.getClosestNode(new Vec2(e.clientX, e.clientY));
    this.draggedNode.immovable = true;
    this.onDrag(e);
  }.bind(this), false);

  this.canvas.addEventListener("mouseup", function (e) {
    e.preventDefault();
    this.draggedNode.immovable = false;
    this.draggedNode = false;
  }.bind(this), false);
};

var DragAdapter = new DragAdapter(canvas, m);

var dt = 0;
var t = new Date();
function animate() {
  dt = new Date() - t;
  t = new Date();

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  m.simulate(dt);
  m.draw(ctx);
  window.requestAnimationFrame(animate);
}

animate();
