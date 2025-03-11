import * as THREE from 'three';
import { MonsterTruck } from './MonsterTruck.js';
import { World } from './World.js';

const TRUCK_SPECS = {
    'NEON CRUSHER': {
        acceleration: 0.019,   // Reduced by 5%
        maxSpeed: 0.95,        // Reduced by 5%
        handling: 0.018,       // Kept the same
        braking: 0.03,         // Kept the same
        mass: 1.0,             // Kept the same
        grip: 0.85,            // Kept the same
        turnInertia: 0.8,      // Kept the same
        deceleration: 0.015,   // Kept the same
        dimensions: { width: 2, height: 1, length: 3 },
        health: 100,           // Base health
        armor: 1.0             // Damage resistance multiplier
    },
    'GRID RIPPER': {
        acceleration: 0.02375,  // Reduced by 5%
        maxSpeed: 1.235,        // Reduced by 5%
        handling: 0.016,        // Kept the same
        braking: 0.025,         // Kept the same
        mass: 0.8,              // Kept the same
        grip: 0.75,             // Kept the same
        turnInertia: 0.9,       // Kept the same
        deceleration: 0.012,    // Kept the same
        dimensions: { width: 1.8, height: 0.8, length: 3.2 },
        health: 80,             // Lower health due to light armor
        armor: 0.7              // Lower damage resistance
    },
    'LASER WHEEL': {
        acceleration: 0.01425,  // Reduced by 5%
        maxSpeed: 0.76,         // Reduced by 5%
        handling: 0.014,        // Kept the same
        braking: 0.035,         // Kept the same
        mass: 1.2,              // Kept the same
        grip: 0.95,             // Kept the same
        turnInertia: 0.7,       // Kept the same
        deceleration: 0.018,    // Kept the same
        dimensions: { width: 2.2, height: 1.2, length: 2.8 },
        health: 120,            // Higher health due to heavy armor
        armor: 1.4              // Higher damage resistance
    }
};

class Projectile {
    constructor(position, direction, speed, damage, source) {
        const geometry = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
        geometry.rotateX(Math.PI / 2);
        
        const projectileColor = source === 'player' ? 0xff00ff : 0xff0000;
        const material = new THREE.MeshPhongMaterial({
            color: new THREE.Color(projectileColor),
            emissive: new THREE.Color(projectileColor),
            emissiveIntensity: 1,
            transparent: true,
            opacity: 0.8,
            shininess: 30
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        
        this.light = new THREE.PointLight(projectileColor, 0.5, 3);
        this.light.position.copy(position);
        
        this.direction = direction.normalize();
        this.speed = speed;
        this.damage = damage;
        this.source = source;
        this.alive = true;
        this.lifespan = 200;
        
        this.mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            this.direction
        );
    }

    update() {
        // Update position with higher speed
        const movement = this.direction.clone().multiplyScalar(this.speed);
        this.mesh.position.add(movement);
        this.light.position.copy(this.mesh.position);
        
        this.lifespan--;
        if (this.lifespan <= 0) this.alive = false;
        
        // Add trail effect
        this.createTrail();
    }

    createTrail() {
        // Create particle trail
        const trailGeometry = new THREE.SphereGeometry(0.05, 4, 4);
        const trailMaterial = new THREE.MeshBasicMaterial({
            color: this.source === 'player' ? 0xff00ff : 0xff0000,
            transparent: true,
            opacity: 0.5
        });
        const trail = new THREE.Mesh(trailGeometry, trailMaterial);
        trail.position.copy(this.mesh.position);
        
        // Fade out and remove trail particles
        setTimeout(() => {
            trail.material.opacity -= 0.1;
            if (trail.material.opacity <= 0) {
                trail.parent.remove(trail);
            }
        }, 50);
        
        return trail;
    }
}

class Turret {
    constructor(position) {
        // Create turret base
        const baseGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
        const baseMaterial = new THREE.MeshPhongMaterial({ 
            color: new THREE.Color(0xff0000),
            shininess: 30
        });
        this.base = new THREE.Mesh(baseGeometry, baseMaterial);
        this.base.position.copy(position);

        // Create turret gun
        const gunGeometry = new THREE.BoxGeometry(0.3, 0.3, 2);
        const gunMaterial = new THREE.MeshPhongMaterial({ 
            color: new THREE.Color(0x666666),
            shininess: 30
        });
        this.gun = new THREE.Mesh(gunGeometry, gunMaterial);
        this.gun.position.y = 0.5;
        this.gun.position.z = 0.5;
        this.base.add(this.gun);

        this.health = 5;
        this.shootCooldown = 0;
        this.alive = true;
    }

    update(playerPosition) {
        if (!this.alive) return;

        // Rotate to face player
        const direction = new THREE.Vector3()
            .subVectors(playerPosition, this.base.position)
            .normalize();
        this.base.rotation.y = Math.atan2(direction.x, direction.z);

        // Update shooting cooldown
        if (this.shootCooldown > 0) this.shootCooldown--;
    }

    damage() {
        this.health--;
        if (this.health <= 0) {
            this.alive = false;
            this.base.material.color.setHex(0x333333); // Darkened color when destroyed
        }
    }

    canShoot() {
        return this.alive && this.shootCooldown <= 0;
    }
}

class Game {
    constructor() {
        console.log("Game constructor called");
        
        // Basic initialization
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.truck = null;
        this.isInitialized = false;
        this.debugMode = true; // Enable debug mode
        this.isGameOver = false;
        
        // Controls
        this.keys = {
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false,
            ' ': false,
            'd': false, // Debug key
            'm': false  // Debug movement
        };
        
        // Game state
        this.health = 100;
        this.score = 0;
        this.sparks = [];
        
        // Shooting mechanics
        this.projectiles = [];
        this.shootCooldown = 0;
        this.ammo = 30; // Limited ammo
        this.maxAmmo = 30;
        this.reloadTime = 0;
        
        // Start initialization
        this.init();
    }
    
    init() {
        console.log("Initializing game");
        
        try {
            // Create scene
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x120023);
            console.log("Scene created");
            
            // Create camera
            this.camera = new THREE.PerspectiveCamera(
                75, 
                window.innerWidth / window.innerHeight, 
                0.1, 
                1000
            );
            this.camera.position.set(0, 5, 10);
            console.log("Camera created");
            
            // Create renderer
            const canvas = document.getElementById('game');
            if (!canvas) {
                console.error("Canvas element not found!");
                return;
            }
            
            this.renderer = new THREE.WebGLRenderer({ 
                canvas: canvas,
                antialias: true 
            });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            console.log("Renderer created");
            
            // Add lights
            this.addLights();
            
            // Add grid and ground
            this.createArena();
            
            // Create a simple truck
            this.createSimpleTruck();
            
            // Create turrets
            this.createTurrets();
            
            // Initialize HUD
            this.initHUD();
            
            // Set up controls
            this.setupControls();
            
            // Mark as initialized
            this.isInitialized = true;
            
            // Remove loading screen
            this.removeLoadingScreen();
            
            console.log("Game initialized, starting animation loop");
            
            // Start animation loop
            this.animate();
        } catch (error) {
            console.error("Error during initialization:", error);
        }
    }
    
    addLights() {
        try {
            // Add ambient light
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            this.scene.add(ambientLight);
            
            // Add directional light
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(50, 50, 50);
            this.scene.add(directionalLight);
            
            console.log("Lights added");
        } catch (error) {
            console.error("Error adding lights:", error);
        }
    }
    
    createArena() {
        try {
            const arenaSize = 400; // 4x larger arena
            console.log("Creating arena with size:", arenaSize);
            
            // Add grid floor
            const gridHelper = new THREE.GridHelper(arenaSize, arenaSize / 4, 0xff00ff, 0x00ffff);
            this.scene.add(gridHelper);
            
            // Add ground plane
            const groundGeometry = new THREE.PlaneGeometry(arenaSize, arenaSize);
            const groundMaterial = new THREE.MeshPhongMaterial({ 
                color: 0x120023,
                shininess: 10
            });
            const ground = new THREE.Mesh(groundGeometry, groundMaterial);
            ground.rotation.x = -Math.PI / 2;
            this.scene.add(ground);
            
            // Create boundary walls - DIRECT APPROACH
            this.createSimpleWalls(arenaSize);
            
            console.log("Arena created");
        } catch (error) {
            console.error("Error creating arena:", error);
        }
    }
    
    // Simplified wall creation - most direct approach possible
    createSimpleWalls(arenaSize) {
        try {
            console.log("Creating simple walls");
            const halfSize = arenaSize / 2;
            
            // Create a bright material that will be visible
            const wallMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff });
            
            // North Wall (back)
            const northWall = new THREE.Mesh(
                new THREE.BoxGeometry(arenaSize, 20, 5),
                wallMaterial
            );
            northWall.position.set(0, 10, -halfSize);
            this.scene.add(northWall);
            console.log("North wall added at", northWall.position);
            
            // South Wall (front)
            const southWall = new THREE.Mesh(
                new THREE.BoxGeometry(arenaSize, 20, 5),
                wallMaterial
            );
            southWall.position.set(0, 10, halfSize);
            this.scene.add(southWall);
            console.log("South wall added at", southWall.position);
            
            // East Wall (right)
            const eastWall = new THREE.Mesh(
                new THREE.BoxGeometry(5, 20, arenaSize),
                wallMaterial
            );
            eastWall.position.set(halfSize, 10, 0);
            this.scene.add(eastWall);
            console.log("East wall added at", eastWall.position);
            
            // West Wall (left)
            const westWall = new THREE.Mesh(
                new THREE.BoxGeometry(5, 20, arenaSize),
                wallMaterial
            );
            westWall.position.set(-halfSize, 10, 0);
            this.scene.add(westWall);
            console.log("West wall added at", westWall.position);
            
            // Add corner markers - very visible
            const cornerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
            const cornerPositions = [
                [-halfSize, 0, -halfSize],
                [halfSize, 0, -halfSize],
                [-halfSize, 0, halfSize],
                [halfSize, 0, halfSize]
            ];
            
            cornerPositions.forEach((pos, index) => {
                const cornerMarker = new THREE.Mesh(
                    new THREE.BoxGeometry(10, 30, 10),
                    cornerMaterial
                );
                cornerMarker.position.set(pos[0], 15, pos[2]);
                this.scene.add(cornerMarker);
                console.log(`Corner marker ${index} added at`, cornerMarker.position);
            });
            
            console.log("All walls created");
        } catch (error) {
            console.error("Error creating walls:", error);
        }
    }
    
    createSimpleTruck() {
        try {
            // Create a simple truck with a box
            const geometry = new THREE.BoxGeometry(2, 1, 3);
            const material = new THREE.MeshPhongMaterial({
                color: 0xff00ff,
                emissive: 0x330033
            });
            
            this.truck = new THREE.Mesh(geometry, material);
            this.truck.position.set(0, 0.5, 0);
            
            // Add physics properties
            this.truck.velocity = 0;
            this.truck.acceleration = 0;
            this.truck.turning = 0;
            
            this.scene.add(this.truck);
            console.log("Truck created at", this.truck.position);
        } catch (error) {
            console.error("Error creating truck:", error);
        }
    }
    
    setupControls() {
        try {
            // Set up keyboard controls
            window.addEventListener('keydown', (e) => {
                if (this.keys.hasOwnProperty(e.key)) {
                    this.keys[e.key] = true;
                    
                    // Debug key to teleport to arena edge
                    if (e.key === 'd' && this.debugMode) {
                        this.teleportToArenaEdge();
                    }
                    
                    // Debug key to log movement data
                    if (e.key === 'm' && this.debugMode) {
                        this.debugMovement();
                    }
                }
            });
            
            window.addEventListener('keyup', (e) => {
                if (this.keys.hasOwnProperty(e.key)) {
                    this.keys[e.key] = false;
                }
            });
            
            // Handle window resize
            window.addEventListener('resize', () => {
                if (this.camera && this.renderer) {
                    this.camera.aspect = window.innerWidth / window.innerHeight;
                    this.camera.updateProjectionMatrix();
                    this.renderer.setSize(window.innerWidth, window.innerHeight);
                }
            });
            
            console.log("Controls set up");
        } catch (error) {
            console.error("Error setting up controls:", error);
        }
    }
    
    // Debug function to teleport to arena edge
    teleportToArenaEdge() {
        if (!this.truck) return;
        
        const arenaSize = 400;
        const halfSize = arenaSize / 2;
        
        // Teleport to north edge
        this.truck.position.set(0, 0.5, -halfSize + 10);
        this.camera.position.set(0, 5, -halfSize + 20);
        
        console.log("Teleported to arena edge at", this.truck.position);
    }
    
    removeLoadingScreen() {
        try {
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.style.opacity = '0';
                loadingScreen.style.transition = 'opacity 0.5s ease';
                setTimeout(() => {
                    loadingScreen.remove();
                }, 500);
            }
            console.log("Loading screen removed");
        } catch (error) {
            console.error("Error removing loading screen:", error);
        }
    }
    
    update() {
        if (!this.isInitialized || this.isGameOver) return;
        
        try {
            // Handle controls
            this.handleControls();
            
            // Update truck position
            this.updateTruck();
            
            // Check for wall collisions
            if (typeof this.checkWallCollisions === 'function') {
                this.checkWallCollisions();
            }
            
            // Update projectiles
            if (typeof this.updateProjectiles === 'function') {
                this.updateProjectiles();
            }
            
            // Update turrets
            if (typeof this.updateTurrets === 'function') {
                this.updateTurrets();
            }
            
            // Update visual effects
            if (typeof this.updateSparks === 'function' && this.sparks && this.sparks.length > 0) {
                this.updateSparks();
            }
            
            // Update camera to follow truck
            this.updateCamera();
            
            // Update HUD
            this.updateHUD();
            
            // Debug info - update position display
            if (this.truck && window.updateDebugInfo) {
                window.updateDebugInfo(this.truck.position);
            }
        } catch (error) {
            console.error("Error in update:", error);
        }
    }
    
    handleControls() {
        if (!this.truck) return;
        
        // Reset acceleration and turning
        this.truck.acceleration = 0;
        this.truck.turning = 0;
        
        // Forward/Backward - FIXED
        if (this.keys.ArrowUp) {
            // Up arrow = forward
            this.truck.acceleration = 0.02;
        } else if (this.keys.ArrowDown) {
            // Down arrow = backward
            this.truck.acceleration = -0.02;
        }
        
        // Turning - FIXED
        if (this.keys.ArrowLeft) {
            // Left arrow = turn left (counter-clockwise)
            this.truck.turning = 0.02;
        } else if (this.keys.ArrowRight) {
            // Right arrow = turn right (clockwise)
            this.truck.turning = -0.02;
        }
        
        // Shooting
        if (this.keys[' '] && this.shootCooldown <= 0 && this.ammo > 0 && this.reloadTime <= 0) {
            this.shoot();
            this.shootCooldown = 10;
            this.ammo--;
            this.updateAmmoDisplay();
        }
        
        // Decrease cooldown
        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        }
        
        // Auto-reload when empty
        if (this.ammo <= 0 && this.reloadTime <= 0) {
            this.reloadTime = 120;
            this.showReloadingMessage();
        }
        
        // Handle reload timer
        if (this.reloadTime > 0) {
            this.reloadTime--;
            if (this.reloadTime === 0) {
                this.ammo = this.maxAmmo;
                this.updateAmmoDisplay();
                this.hideReloadingMessage();
            }
        }
    }
    
    updateTruck() {
        if (!this.truck) return;
        
        // Update velocity based on acceleration
        this.truck.velocity += this.truck.acceleration;
        
        // Apply speed limits
        const maxSpeed = 1.0;
        if (Math.abs(this.truck.velocity) > maxSpeed) {
            this.truck.velocity = Math.sign(this.truck.velocity) * maxSpeed;
        }
        
        // Apply friction/drag to gradually slow down
        const friction = 0.02;
        this.truck.velocity *= (1 - friction);
        
        // Stop completely if very slow
        if (Math.abs(this.truck.velocity) < 0.001) {
            this.truck.velocity = 0;
        }
        
        // Only update position if moving
        if (Math.abs(this.truck.velocity) > 0) {
            // Calculate movement direction based on truck's rotation
            // FIXED: Ensure correct direction calculation
            const moveX = Math.sin(this.truck.rotation.y) * this.truck.velocity;
            const moveZ = Math.cos(this.truck.rotation.y) * this.truck.velocity;
            
            // Apply movement
            this.truck.position.x += moveX;
            this.truck.position.z += moveZ;
        }
        
        // Apply turning (always update rotation)
        this.truck.rotation.y += this.truck.turning;
        
        // Update speed display
        this.updateSpeedDisplay();
    }
    
    updateCamera() {
        if (!this.camera || !this.truck) return;
        
        // Basic follow camera
        const cameraDistance = 5;
        const cameraHeight = 3;
        
        this.camera.position.x = this.truck.position.x - Math.sin(this.truck.rotation.y) * cameraDistance;
        this.camera.position.z = this.truck.position.z - Math.cos(this.truck.rotation.y) * cameraDistance;
        this.camera.position.y = cameraHeight;
        
        this.camera.lookAt(this.truck.position);
    }
    
    animate() {
        if (!this.isInitialized) return;
        
        requestAnimationFrame(() => this.animate());
        
        try {
            // Update game state
            this.update();
            
            // Render scene
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }
        } catch (error) {
            console.error("Error in animate:", error);
        }
    }

    // Add collision detection and handling to the Game class

    // First, let's add a method to check for collisions with walls
    checkWallCollisions() {
        if (!this.truck) return false;
        
        const arenaSize = 400;
        const halfSize = arenaSize / 2;
        const wallThickness = 5;
        
        // Get truck dimensions
        const truckWidth = 2;
        const truckLength = 3;
        
        // Calculate truck bounds with some buffer for collision detection
        const truckBounds = {
            minX: this.truck.position.x - truckWidth/2 - 0.2,
            maxX: this.truck.position.x + truckWidth/2 + 0.2,
            minZ: this.truck.position.z - truckLength/2 - 0.2,
            maxZ: this.truck.position.z + truckLength/2 + 0.2
        };
        
        // Check collision with each wall
        let collision = false;
        let collisionNormal = { x: 0, z: 0 };
        
        // North wall (back)
        if (truckBounds.minZ <= -halfSize + wallThickness) {
            collision = true;
            collisionNormal = { x: 0, z: 1 }; // Pointing south
            this.truck.position.z = -halfSize + wallThickness + truckLength/2 + 0.2; // Push back
        }
        
        // South wall (front)
        else if (truckBounds.maxZ >= halfSize - wallThickness) {
            collision = true;
            collisionNormal = { x: 0, z: -1 }; // Pointing north
            this.truck.position.z = halfSize - wallThickness - truckLength/2 - 0.2; // Push back
        }
        
        // East wall (right)
        else if (truckBounds.maxX >= halfSize - wallThickness) {
            collision = true;
            collisionNormal = { x: -1, z: 0 }; // Pointing west
            this.truck.position.x = halfSize - wallThickness - truckWidth/2 - 0.2; // Push back
        }
        
        // West wall (left)
        else if (truckBounds.minX <= -halfSize + wallThickness) {
            collision = true;
            collisionNormal = { x: 1, z: 0 }; // Pointing east
            this.truck.position.x = -halfSize + wallThickness + truckWidth/2 + 0.2; // Push back
        }
        
        // Handle collision if detected
        if (collision) {
            this.handleWallCollision(collisionNormal);
        }
        
        return collision;
    }

    // Handle wall collision with damage and bounce effect
    handleWallCollision(normal) {
        // Calculate impact speed (how fast we're moving toward the wall)
        const impactSpeed = Math.abs(this.truck.velocity);
        
        // Only process significant collisions
        if (impactSpeed < 0.05) return;
        
        console.log(`Wall collision detected with impact speed: ${impactSpeed}`);
        
        // Calculate damage based on impact speed
        const damage = Math.floor(impactSpeed * 50);
        
        // Apply damage
        this.takeDamage(damage);
        
        // Bounce effect - reverse velocity with damping
        this.truck.velocity = -this.truck.velocity * 0.7;
        
        // Add visual and audio feedback
        this.showCollisionEffect(impactSpeed);
        
        // Add camera shake based on impact
        this.shakeCamera(impactSpeed * 3);
    }

    // Take damage method
    takeDamage(amount) {
        // Update health
        this.health = Math.max(0, this.health - amount);
        
        console.log(`Taking ${amount} damage. Health now: ${this.health}`);
        
        // Update HUD
        const healthDisplay = document.getElementById('health');
        if (healthDisplay) {
            // Color coding based on health
            let healthColor = '#00ff00'; // Green
            
            if (this.health < 30) {
                healthColor = '#ff0000'; // Red
            } else if (this.health < 70) {
                healthColor = '#ffff00'; // Yellow
            }
            
            healthDisplay.innerHTML = `HEALTH: <span style="color:${healthColor}">${this.health}%</span>`;
        }
        
        // Check for game over
        if (this.health <= 0) {
            this.gameOver();
        }
    }

    // Show collision effect
    showCollisionEffect(intensity) {
        // Flash the screen red
        const flashOverlay = document.createElement('div');
        flashOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(255, 0, 0, ${Math.min(0.7, intensity)});
            pointer-events: none;
            z-index: 1000;
            opacity: 0.7;
        `;
        
        document.body.appendChild(flashOverlay);
        
        // Fade out and remove
        setTimeout(() => {
            flashOverlay.style.transition = 'opacity 0.5s';
            flashOverlay.style.opacity = '0';
            setTimeout(() => {
                flashOverlay.remove();
            }, 500);
        }, 100);
        
        // Add spark particles at collision point
        this.createCollisionSparks();
    }

    // Create spark particles at collision point
    createCollisionSparks() {
        if (!this.scene || !this.truck) return;
        
        // Create 10-20 spark particles
        const sparkCount = 10 + Math.floor(Math.random() * 10);
        const sparkGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        
        // Ensure sparks array exists
        if (!this.sparks) this.sparks = [];
        
        for (let i = 0; i < sparkCount; i++) {
            const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
            
            // Position at truck
            spark.position.copy(this.truck.position);
            
            // Random velocity
            const velocity = {
                x: (Math.random() - 0.5) * 0.3,
                y: Math.random() * 0.2 + 0.1,
                z: (Math.random() - 0.5) * 0.3
            };
            
            // Add to scene
            this.scene.add(spark);
            
            // Add to sparks array for animation
            this.sparks.push({
                mesh: spark,
                velocity: velocity,
                life: 1.0 // Life counter (1.0 to 0.0)
            });
        }
    }

    // Add camera shake effect
    shakeCamera(intensity) {
        if (!this.camera) return;
        
        // Store original camera position
        if (!this.cameraBasePosition) {
            this.cameraBasePosition = {
                x: this.camera.position.x,
                y: this.camera.position.y,
                z: this.camera.position.z
            };
        }
        
        // Set shake parameters
        this.shakeIntensity = intensity;
        this.shakeDuration = 500; // ms
        this.shakeStartTime = Date.now();
        
        // Start shake if not already shaking
        if (!this.isShaking) {
            this.isShaking = true;
            this.updateCameraShake();
        }
    }

    // Update camera shake
    updateCameraShake() {
        if (!this.isShaking || !this.camera) return;
        
        const elapsed = Date.now() - this.shakeStartTime;
        
        if (elapsed < this.shakeDuration) {
            // Calculate remaining shake intensity
            const remaining = 1 - (elapsed / this.shakeDuration);
            const currentIntensity = this.shakeIntensity * remaining;
            
            // Apply random offset to camera
            this.camera.position.x += (Math.random() - 0.5) * currentIntensity;
            this.camera.position.y += (Math.random() - 0.5) * currentIntensity;
            this.camera.position.z += (Math.random() - 0.5) * currentIntensity;
            
            // Continue shaking
            requestAnimationFrame(() => this.updateCameraShake());
        } else {
            // End shake
            this.isShaking = false;
        }
    }

    // Game over method
    gameOver() {
        if (this.isGameOver) return;
        
        this.isGameOver = true;
        console.log("Game over!");
        
        // Create game over overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            font-family: 'Orbitron', sans-serif;
            color: #ff00ff;
        `;

        overlay.innerHTML = `
            <h1 style="text-shadow: 0 0 10px #ff00ff;">GAME OVER!</h1>
            <h2 style="text-shadow: 0 0 10px #ff00ff;">SCORE: ${this.score}</h2>
            <button onclick="window.location.reload()" style="
                background: linear-gradient(45deg, #ff00ff, #aa00ff);
                color: white;
                border: none;
                padding: 15px 30px;
                margin-top: 20px;
                font-size: 18px;
                border-radius: 5px;
                cursor: pointer;
                font-family: 'Orbitron', sans-serif;
                text-transform: uppercase;
                letter-spacing: 2px;
                box-shadow: 0 0 20px rgba(255, 0, 255, 0.5);
            ">TRY AGAIN</button>
        `;

        document.body.appendChild(overlay);
    }

    // Update HUD method
    updateHUD() {
        // Update speed display
        const speedDisplay = document.getElementById('speed');
        if (speedDisplay && this.truck) {
            const speedMPH = Math.abs(Math.round(this.truck.velocity * 100));
            speedDisplay.textContent = `SPEED: ${speedMPH} MPH`;
        }
    }

    // Add shooting mechanics to the Game class

    // Shoot method
    shoot() {
        if (!this.scene || !this.truck) return;
        
        console.log("Shooting projectile");
        
        // Create projectile
        const projectileGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8);
        projectileGeometry.rotateX(Math.PI / 2); // Rotate to point forward
        
        const projectileMaterial = new THREE.MeshPhongMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 1,
            shininess: 30
        });
        
        const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
        
        // Calculate direction based on truck's rotation - FIXED: Correct direction calculation
        const truckDirection = new THREE.Vector3(
            Math.sin(this.truck.rotation.y), // X component
            0,                               // Y component (level)
            Math.cos(this.truck.rotation.y)  // Z component
        );
        
        // Position at front of truck
        projectile.position.copy(this.truck.position);
        projectile.position.y += 0.5; // Slightly above truck
        projectile.position.x += truckDirection.x * 2; // In front of truck
        projectile.position.z += truckDirection.z * 2;
        
        // Set rotation to match truck direction
        projectile.rotation.y = this.truck.rotation.y;
        
        // Add to scene
        this.scene.add(projectile);
        
        // Store projectile data
        this.projectiles.push({
            mesh: projectile,
            direction: truckDirection,
            speed: 2.0, // Fast projectile
            damage: 20,
            lifetime: 100, // Frames before despawning
            source: 'player'
        });
        
        // Add muzzle flash effect
        this.createMuzzleFlash(projectile.position.clone(), truckDirection);
        
        // Add recoil effect
        this.truck.velocity -= 0.02; // Small backward push
    }

    // Create muzzle flash effect
    createMuzzleFlash(position, direction) {
        // Create point light for flash
        const flashLight = new THREE.PointLight(0x00ffff, 2, 5);
        flashLight.position.copy(position);
        this.scene.add(flashLight);
        
        // Create flash sprite
        const flashGeometry = new THREE.PlaneGeometry(1, 1);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 1
        });
        
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(position);
        flash.lookAt(position.x + direction.x, position.y + direction.y, position.z + direction.z);
        this.scene.add(flash);
        
        // Fade out and remove
        let flashLife = 5;
        const fadeFlash = () => {
            flashLife--;
            if (flashLife > 0) {
                flashLight.intensity = flashLife / 5 * 2;
                flash.material.opacity = flashLife / 5;
                requestAnimationFrame(fadeFlash);
            } else {
                this.scene.remove(flashLight);
                this.scene.remove(flash);
            }
        };
        
        fadeFlash();
    }

    // Update projectiles
    updateProjectiles() {
        if (!this.projectiles || !this.scene) return;
        
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            
            // Update position - FIXED: Correct direction application
            projectile.mesh.position.x += projectile.direction.x * projectile.speed;
            projectile.mesh.position.z += projectile.direction.z * projectile.speed;
            
            // Add tracer effect
            this.createProjectileTrail(projectile);
            
            // Decrease lifetime
            projectile.lifetime--;
            
            // Check for collisions
            const hitResult = this.checkProjectileCollisions(projectile);
            
            // Remove if lifetime ended or collision occurred
            if (projectile.lifetime <= 0 || hitResult) {
                this.scene.remove(projectile.mesh);
                this.projectiles.splice(i, 1);
                
                // Create impact effect if collision occurred
                if (hitResult) {
                    this.createImpactEffect(projectile.mesh.position, hitResult);
                }
            }
        }
    }

    // Create projectile trail effect
    createProjectileTrail(projectile) {
        // Create small trail particles
        const trailGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        const trailMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.7
        });
        
        const trail = new THREE.Mesh(trailGeometry, trailMaterial);
        trail.position.copy(projectile.mesh.position);
        this.scene.add(trail);
        
        // Fade out and remove
        let trailLife = 10;
        const fadeTrail = () => {
            trailLife--;
            if (trailLife > 0) {
                trail.material.opacity = trailLife / 10 * 0.7;
                trail.scale.multiplyScalar(0.9);
                requestAnimationFrame(fadeTrail);
            } else {
                this.scene.remove(trail);
            }
        };
        
        fadeTrail();
    }

    // Check projectile collisions
    checkProjectileCollisions(projectile) {
        // Get projectile position
        const pos = projectile.mesh.position;
        
        // Check collision with walls
        const arenaSize = 400;
        const halfSize = arenaSize / 2;
        const wallThickness = 5;
        
        // Wall collision
        if (
            pos.x > halfSize - wallThickness || 
            pos.x < -halfSize + wallThickness ||
            pos.z > halfSize - wallThickness || 
            pos.z < -halfSize + wallThickness
        ) {
            return 'wall';
        }
        
        // Check collision with truck (only if not player's projectile)
        if (projectile.source !== 'player' && this.truck) {
            const truckBounds = {
                minX: this.truck.position.x - 1,
                maxX: this.truck.position.x + 1,
                minZ: this.truck.position.z - 1.5,
                maxZ: this.truck.position.z + 1.5
            };
            
            if (
                pos.x >= truckBounds.minX && 
                pos.x <= truckBounds.maxX &&
                pos.z >= truckBounds.minZ && 
                pos.z <= truckBounds.maxZ &&
                pos.y <= this.truck.position.y + 1
            ) {
                // Player hit by projectile
                this.takeDamage(projectile.damage);
                return 'player';
            }
        }
        
        // Check collision with turrets (if implemented)
        if (this.turrets) {
            for (let i = 0; i < this.turrets.length; i++) {
                const turret = this.turrets[i];
                
                // Skip destroyed turrets
                if (turret.destroyed) continue;
                
                const turretBounds = {
                    minX: turret.mesh.position.x - 1.5,
                    maxX: turret.mesh.position.x + 1.5,
                    minZ: turret.mesh.position.z - 1.5,
                    maxZ: turret.mesh.position.z + 1.5
                };
                
                if (
                    pos.x >= turretBounds.minX && 
                    pos.x <= turretBounds.maxX &&
                    pos.z >= turretBounds.minZ && 
                    pos.z <= turretBounds.maxZ &&
                    pos.y <= turret.mesh.position.y + 2
                ) {
                    // Turret hit by projectile
                    if (projectile.source === 'player') {
                        this.damageTurret(turret, projectile.damage);
                        return 'turret';
                    }
                }
            }
        }
        
        return null;
    }

    // Create impact effect
    createImpactEffect(position, targetType) {
        // Create flash
        const impactLight = new THREE.PointLight(
            targetType === 'wall' ? 0x00ffff : 0xff0000, 
            1, 
            5
        );
        impactLight.position.copy(position);
        this.scene.add(impactLight);
        
        // Create particles
        const particleCount = 10;
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: targetType === 'wall' ? 0x00ffff : 0xff0000,
                transparent: true,
                opacity: 1
            });
            
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.position.copy(position);
            
            // Random velocity
            particle.velocity = {
                x: (Math.random() - 0.5) * 0.2,
                y: Math.random() * 0.2,
                z: (Math.random() - 0.5) * 0.2
            };
            
            this.scene.add(particle);
            particles.push(particle);
        }
        
        // Animate particles
        let impactLife = 20;
        const animateImpact = () => {
            impactLife--;
            
            if (impactLife > 0) {
                // Update light
                impactLight.intensity = impactLife / 20;
                
                // Update particles
                for (const particle of particles) {
                    particle.position.x += particle.velocity.x;
                    particle.position.y += particle.velocity.y;
                    particle.position.z += particle.velocity.z;
                    
                    // Apply gravity
                    particle.velocity.y -= 0.01;
                    
                    // Fade out
                    particle.material.opacity = impactLife / 20;
                }
                
                requestAnimationFrame(animateImpact);
            } else {
                // Remove light and particles
                this.scene.remove(impactLight);
                for (const particle of particles) {
                    this.scene.remove(particle);
                }
            }
        };
        
        animateImpact();
    }

    // Update ammo display
    updateAmmoDisplay() {
        const ammoDisplay = document.getElementById('ammo');
        if (ammoDisplay) {
            ammoDisplay.textContent = `AMMO: ${this.ammo}/${this.maxAmmo}`;
        }
    }

    // Show reloading message
    showReloadingMessage() {
        const ammoDisplay = document.getElementById('ammo');
        if (ammoDisplay) {
            ammoDisplay.innerHTML = `<span style="color: #ff0000;">RELOADING...</span>`;
        }
    }

    // Hide reloading message
    hideReloadingMessage() {
        const ammoDisplay = document.getElementById('ammo');
        if (ammoDisplay) {
            ammoDisplay.textContent = `AMMO: ${this.ammo}/${this.maxAmmo}`;
        }
    }

    // Add turret-related methods to the Game class

    // Create turrets
    createTurrets() {
        if (!this.scene) return;
        
        console.log("Creating turrets");
        
        this.turrets = [];
        
        // Create several turrets around the arena
        const arenaSize = 400;
        const turretPositions = [
            { x: -150, z: -150 },
            { x: 150, z: -150 },
            { x: -150, z: 150 },
            { x: 150, z: 150 },
            { x: 0, z: -100 },
            { x: 0, z: 100 },
            { x: -100, z: 0 },
            { x: 100, z: 0 }
        ];
        
        turretPositions.forEach(pos => {
            this.createTurret(pos.x, pos.z);
        });
    }

    // Create a single turret
    createTurret(x, z) {
        // Create base
        const baseGeometry = new THREE.CylinderGeometry(2, 2.5, 1, 16);
        const baseMaterial = new THREE.MeshPhongMaterial({
            color: 0x333333,
            shininess: 30
        });
        
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.set(x, 0.5, z);
        this.scene.add(base);
        
        // Create turret body
        const bodyGeometry = new THREE.BoxGeometry(2, 1.5, 2);
        const bodyMaterial = new THREE.MeshPhongMaterial({
            color: 0x666666,
            shininess: 30
        });
        
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.set(0, 1.25, 0);
        base.add(body);
        
        // Create gun barrel
        const barrelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 3, 8);
        barrelGeometry.rotateX(Math.PI / 2); // Rotate to point forward
        
        const barrelMaterial = new THREE.MeshPhongMaterial({
            color: 0x444444,
            shininess: 50
        });
        
        const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        barrel.position.set(0, 0, 1.5); // Extend forward
        body.add(barrel);
        
        // Add turret to list
        this.turrets.push({
            mesh: base,
            body: body,
            barrel: barrel,
            health: 100,
            maxHealth: 100,
            shootCooldown: Math.floor(Math.random() * 60), // Random initial cooldown
            destroyed: false,
            lastShotTime: 0
        });
    }

    // Update turrets
    updateTurrets() {
        if (!this.turrets || !this.truck) return;
        
        for (const turret of this.turrets) {
            // Skip destroyed turrets
            if (turret.destroyed) continue;
            
            // Calculate direction to player
            const directionToPlayer = new THREE.Vector3(
                this.truck.position.x - turret.mesh.position.x,
                0,
                this.truck.position.z - turret.mesh.position.z
            );
            
            // Calculate distance to player
            const distanceToPlayer = directionToPlayer.length();
            
            // Only track and shoot if player is within range
            if (distanceToPlayer < 100) {
                // Normalize direction
                directionToPlayer.normalize();
                
                // Calculate target rotation
                const targetRotation = Math.atan2(directionToPlayer.x, directionToPlayer.z);
                
                // Smoothly rotate body towards player
                const currentRotation = turret.body.rotation.y;
                const rotationDiff = targetRotation - currentRotation;
                
                // Handle angle wrapping
                let shortestRotation = ((rotationDiff + Math.PI) % (Math.PI * 2)) - Math.PI;
                
                // Apply rotation with smoothing
                turret.body.rotation.y += shortestRotation * 0.05;
                
                // Shoot at player if cooldown is ready and facing player
                if (
                    turret.shootCooldown <= 0 && 
                    Math.abs(shortestRotation) < 0.2 &&
                    this.canTurretSeePlayer(turret)
                ) {
                    this.turretShoot(turret);
                    turret.shootCooldown = 120; // 2 seconds between shots
                    turret.lastShotTime = Date.now();
                }
            }
            
            // Decrease cooldown
            if (turret.shootCooldown > 0) {
                turret.shootCooldown--;
            }
            
            // Pulse effect for active turrets
            const timeSinceShot = Date.now() - turret.lastShotTime;
            if (timeSinceShot < 1000) {
                const pulse = 1 + Math.sin(timeSinceShot / 100) * 0.1;
                turret.body.scale.set(pulse, pulse, pulse);
            } else {
                turret.body.scale.set(1, 1, 1);
            }
        }
    }

    // Check if turret has line of sight to player
    canTurretSeePlayer(turret) {
        if (!this.truck) return false;
        
        // Create ray from turret to player
        const start = new THREE.Vector3(
            turret.mesh.position.x,
            turret.mesh.position.y + 1.5,
            turret.mesh.position.z
        );
        
        const end = new THREE.Vector3(
            this.truck.position.x,
            this.truck.position.y + 0.5,
            this.truck.position.z
        );
        
        const direction = new THREE.Vector3().subVectors(end, start).normalize();
        
        // Simple line of sight check - could be enhanced with raycasting
        return true; // For now, always return true
    }

    // Turret shoot method
    turretShoot(turret) {
        if (!this.scene || turret.destroyed) return;
        
        // Calculate barrel position and direction
        const barrelWorldPos = new THREE.Vector3();
        turret.barrel.getWorldPosition(barrelWorldPos);
        
        const directionToPlayer = new THREE.Vector3(
            this.truck.position.x - turret.mesh.position.x,
            0,
            this.truck.position.z - turret.mesh.position.z
        ).normalize();
        
        // Create projectile
        const projectileGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const projectileMaterial = new THREE.MeshPhongMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.5
        });
        
        const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
        projectile.position.copy(barrelWorldPos);
        
        // Add to scene
        this.scene.add(projectile);
        
        // Store projectile data
        this.projectiles.push({
            mesh: projectile,
            direction: directionToPlayer,
            speed: 1.5, // Slower than player projectiles
            damage: 10,
            lifetime: 100,
            source: 'turret'
        });
        
        // Add muzzle flash effect
        this.createMuzzleFlash(barrelWorldPos, directionToPlayer);
    }

    // Damage turret method
    damageTurret(turret, amount) {
        // Reduce health
        turret.health -= amount;
        
        // Check if destroyed
        if (turret.health <= 0 && !turret.destroyed) {
            this.destroyTurret(turret);
        } else {
            // Visual feedback for damage
            turret.mesh.material = new THREE.MeshPhongMaterial({
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 0.3,
                transparent: true,
                opacity: 1
            });
            
            // Fade back to normal
            setTimeout(() => {
                if (!turret.destroyed) {
                    turret.mesh.material = new THREE.MeshPhongMaterial({
                        color: 0x333333,
                        shininess: 30
                    });
                }
            }, 200);
        }
    }

    // Destroy turret method
    destroyTurret(turret) {
        turret.destroyed = true;
        
        // Change appearance
        turret.mesh.material = new THREE.MeshPhongMaterial({
            color: 0x000000,
            emissive: 0xff0000,
            emissiveIntensity: 0.2,
            transparent: true,
            opacity: 0.8
        });
        
        // Tilt to show destruction
        turret.mesh.rotation.x = Math.random() * 0.5 - 0.25;
        turret.mesh.rotation.z = Math.random() * 0.5 - 0.25;
        
        // Create explosion effect
        this.createExplosion(turret.mesh.position);
        
        // Increase score
        this.score += 100;
        
        // Update score display
        const scoreDisplay = document.getElementById('score');
        if (scoreDisplay) {
            scoreDisplay.textContent = `SCORE: ${this.score}`;
        }
    }

    // Create explosion effect
    createExplosion(position) {
        // Create flash
        const explosionLight = new THREE.PointLight(0xff5500, 3, 20);
        explosionLight.position.copy(position);
        explosionLight.position.y += 2;
        this.scene.add(explosionLight);
        
        // Create explosion particles
        const particleCount = 30;
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const size = Math.random() * 0.5 + 0.2;
            const particleGeometry = new THREE.SphereGeometry(size, 8, 8);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: i % 2 === 0 ? 0xff5500 : 0xffff00,
                transparent: true,
                opacity: 1
            });
            
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.position.copy(position);
            particle.position.y += 2;
            
            // Random velocity
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 0.3 + 0.1;
            particle.velocity = {
                x: Math.cos(angle) * speed,
                y: Math.random() * 0.3 + 0.2,
                z: Math.sin(angle) * speed
            };
            
            this.scene.add(particle);
            particles.push(particle);
        }
        
        // Animate explosion
        let explosionLife = 60;
        const animateExplosion = () => {
            explosionLife--;
            
            if (explosionLife > 0) {
                // Update light
                explosionLight.intensity = explosionLife / 20;
                
                // Update particles
                for (const particle of particles) {
                    particle.position.x += particle.velocity.x;
                    particle.position.y += particle.velocity.y;
                    particle.position.z += particle.velocity.z;
                    
                    // Apply gravity
                    particle.velocity.y -= 0.01;
                    
                    // Fade out
                    particle.material.opacity = explosionLife / 60;
                }
                
                requestAnimationFrame(animateExplosion);
            } else {
                // Remove light and particles
                this.scene.remove(explosionLight);
                for (const particle of particles) {
                    this.scene.remove(particle);
                }
            }
        };
        
        animateExplosion();
    }

    // Initialize with ammo display
    initHUD() {
        const playerName = document.getElementById('playerName');
        const health = document.getElementById('health');
        const score = document.getElementById('score');
        const ammo = document.getElementById('ammo');
        
        if (playerName) playerName.textContent = localStorage.getItem('monsterTruckNickname') || 'PLAYER';
        if (health) health.innerHTML = `HEALTH: <span style="color:#00ff00">${this.health}%</span>`;
        if (score) score.textContent = `SCORE: ${this.score}`;
        if (ammo) ammo.textContent = `AMMO: ${this.ammo}/${this.maxAmmo}`;
    }

    // Debug method to help diagnose movement issues
    debugMovement() {
        if (!this.truck) return;
        
        console.log({
            position: {
                x: this.truck.position.x.toFixed(2),
                y: this.truck.position.y.toFixed(2),
                z: this.truck.position.z.toFixed(2)
            },
            rotation: {
                y: (this.truck.rotation.y * 180 / Math.PI).toFixed(2) + "°"
            },
            velocity: this.truck.velocity.toFixed(3),
            acceleration: this.truck.acceleration.toFixed(3),
            turning: this.truck.turning.toFixed(3),
            controls: {
                up: this.keys.ArrowUp,
                down: this.keys.ArrowDown,
                left: this.keys.ArrowLeft,
                right: this.keys.ArrowRight
            }
        });
    }

    // Update speed display
    updateSpeedDisplay() {
        const speedDisplay = document.getElementById('speed');
        if (speedDisplay && this.truck) {
            const speedMPH = Math.abs(Math.round(this.truck.velocity * 100));
            speedDisplay.textContent = `SPEED: ${speedMPH} MPH`;
        }
    }

    // Add the missing updateSparks function
    updateSparks() {
        if (!this.sparks || !this.scene || this.sparks.length === 0) return;
        
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const spark = this.sparks[i];
            
            // Update position
            spark.mesh.position.x += spark.velocity.x;
            spark.mesh.position.y += spark.velocity.y;
            spark.mesh.position.z += spark.velocity.z;
            
            // Apply gravity
            spark.velocity.y -= 0.01;
            
            // Reduce life
            spark.life -= 0.02;
            
            // Scale down as life decreases
            spark.mesh.scale.set(spark.life, spark.life, spark.life);
            
            // Remove if dead
            if (spark.life <= 0) {
                this.scene.remove(spark.mesh);
                this.sparks.splice(i, 1);
            }
        }
    }
}

// Initialize game when window is fully loaded
window.addEventListener('load', () => {
    console.log("Window loaded, creating game");
    new Game();
});

export default Game;
