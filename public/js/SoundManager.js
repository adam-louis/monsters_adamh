import * as THREE from 'three';

export class SoundManager {
    constructor(camera) {
        // Create audio context
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create Three.js audio listener and attach to camera
        this.listener = new THREE.AudioListener();
        if (camera) {
            this.camera = camera;
            camera.add(this.listener);
            console.log('Audio listener attached to camera');
        } else {
            console.warn('No camera provided to SoundManager');
        }
        
        // Initialize sound pools
        this.soundPools = new Map();
        this.activeSounds = new Map();
        
        // Music tracks
        this.musicTracks = new Map();
        this.currentMusic = null;
        
        // Volume settings
        this.masterVolume = 1.0;
        this.sfxVolume = 0.7; // Increase default volume to make sounds more noticeable
        this.musicVolume = 0.3;
        
        // Diagnostic info
        console.log('Audio initialization:');
        console.log('  - Context state:', this.listener.context.state);
        console.log('  - Sample rate:', this.listener.context.sampleRate);
        console.log('  - Output channels:', this.listener.context.destination.channelCount);
        console.log('  - Browser audio support:', this.detectAudioSupport());
        
        console.log('Initializing sound pools...');
        this.initializeSoundPools();
        
        // Load music tracks
        console.log('Loading music tracks...');
        this.initializeMusicTracks();
        
        // Check audio context state
        this.checkAudioContext();
        
        // Add global handler for user interaction
        this.setupGlobalAudioUnlock();
    }
    
    detectAudioSupport() {
        // Check basic Web Audio API support
        const hasAudioContext = !!(window.AudioContext || window.webkitAudioContext);
        const hasAudioElement = !!window.Audio;
        
        // Check for various audio formats support
        const audio = new Audio();
        const formats = {
            mp3: typeof audio.canPlayType === 'function' ? audio.canPlayType('audio/mpeg') : 'unknown',
            wav: typeof audio.canPlayType === 'function' ? audio.canPlayType('audio/wav') : 'unknown',
            ogg: typeof audio.canPlayType === 'function' ? audio.canPlayType('audio/ogg') : 'unknown'
        };
        
        return {
            hasAudioContext,
            hasAudioElement,
            formats
        };
    }
    
    setupGlobalAudioUnlock() {
        // Functions to attempt unlocking audio
        const unlockAudio = () => {
            console.log('User interaction detected, attempting to unlock audio');
            
            // Create and play a silent buffer to unlock audio
            const buffer = this.listener.context.createBuffer(1, 1, 22050);
            const source = this.listener.context.createBufferSource();
            source.buffer = buffer;
            source.connect(this.listener.context.destination);
            source.start(0);
            
            // Resume audio context
            if (this.listener.context.state === 'suspended') {
                this.listener.context.resume().then(() => {
                    console.log('Audio context successfully resumed by user interaction');
                    
                    // Try playing a test sound to verify everything is working
                    setTimeout(() => {
                        this.playTestSound();
                    }, 500);
                });
            }
            
            // Remove event listeners once unlocked
            document.removeEventListener('click', unlockAudio);
            document.removeEventListener('touchstart', unlockAudio);
            document.removeEventListener('touchend', unlockAudio);
            document.removeEventListener('keydown', unlockAudio);
        };
        
        document.addEventListener('click', unlockAudio);
        document.addEventListener('touchstart', unlockAudio);
        document.addEventListener('touchend', unlockAudio);
        document.addEventListener('keydown', unlockAudio);
        
        console.log('Global audio unlock handlers set up - waiting for user interaction');
    }
    
    playTestSound() {
        console.log('Playing test sound to verify audio is working');
        
        // Create a test oscillator
        const oscillator = this.listener.context.createOscillator();
        const gainNode = this.listener.context.createGain();
        
        // Set very low volume so it's barely audible
        gainNode.gain.value = 0.01;
        
        oscillator.connect(gainNode);
        gainNode.connect(this.listener.context.destination);
        
        // Play a short beep
        oscillator.frequency.value = 440; // A4 note
        oscillator.start();
        
        // Stop after 100ms
        setTimeout(() => {
            oscillator.stop();
            console.log('Test sound completed');
        }, 100);
    }
    
    checkAudioContext() {
        if (this.listener.context.state === 'suspended') {
            console.log('Audio context is suspended. Waiting for user interaction...');
            const resumeAudio = () => {
                console.log('Attempting to resume audio context...');
                this.listener.context.resume().then(() => {
                    console.log('Audio context resumed successfully');
                    // Retry loading sounds after context is resumed
                    this.initializeSoundPools();
                }).catch(error => {
                    console.error('Error resuming audio context:', error);
                });
                document.removeEventListener('click', resumeAudio);
                document.removeEventListener('keydown', resumeAudio);
                document.removeEventListener('touchstart', resumeAudio);
            };
            
            document.addEventListener('click', resumeAudio);
            document.addEventListener('keydown', resumeAudio);
            document.addEventListener('touchstart', resumeAudio);
        } else {
            console.log('Audio context is ready:', this.listener.context.state);
        }
    }
    
    initializeSoundPools() {
        // Vehicle sounds
        this.createSoundPool('engine_idle', 'sounds/engine_idle.mp3', 1);
        this.createSoundPool('engine_rev', 'sounds/engine_rev.mp3', 1);
        this.createSoundPool('tire_screech', 'sounds/tire_screech.mp3', 3);
        this.createSoundPool('suspension_bounce', 'sounds/suspension_bounce.mp3', 3);
        
        // Weapon sounds
        this.createSoundPool('shoot', 'sounds/weapon_fire.mp3', 5);
        this.createSoundPool('explosion', 'sounds/vehicle_explosion.mp3', 3);
        this.createSoundPool('hit', 'sounds/projectile_hit.mp3', 3);
        this.createSoundPool('turret_shoot', 'sounds/turret_rotate.mp3', 5);
        
        // Damage sounds
        this.createSoundPool('wall_hit', 'sounds/metal_impact.mp3', 3);
        this.createSoundPool('vehicle_hit', 'sounds/vehicle_hit.mp3', 3);
        this.createSoundPool('metal_impact', 'sounds/metal_impact.mp3', 3);
        this.createSoundPool('damage_warning', 'sounds/damage_warning.mp3', 1);
        this.createSoundPool('shield_hit', 'sounds/shield_hit.mp3', 3);
        
        // Powerup sounds
        this.createSoundPool('powerup_pickup', 'sounds/powerup_pickup.mp3', 3);
        this.createSoundPool('powerup_speed', 'sounds/powerup_speed.mp3', 2);
        this.createSoundPool('powerup_shield', 'sounds/powerup_shield.mp3', 2);
        this.createSoundPool('powerup_health', 'sounds/powerup_health.mp3', 2);
        this.createSoundPool('powerup_damage', 'sounds/powerup_damage.mp3', 2);
        this.createSoundPool('powerup_ammo', 'sounds/powerup_ammo.mp3', 2);
        
        // UI sounds
        this.createSoundPool('menu_select', 'sounds/menu_select.mp3', 1);
        this.createSoundPool('menu_confirm', 'sounds/menu_confirm.mp3', 1);
        this.createSoundPool('menu_back', 'sounds/menu_back.mp3', 1);
        this.createSoundPool('chat_message', 'sounds/chat_message.mp3', 1);
    }
    
    initializeMusicTracks() {
        // Load all music tracks from the pattern_bar_live series
        for (let i = 0; i <= 18; i++) {
            const trackNum = i.toString().padStart(2, '0');
            const trackName = `pattern_bar_live_part${trackNum}`;
            this.loadMusicTrack(trackName, `music/${trackName}.mp3`);
        }
        
        // Load fallback track
        this.loadMusicTrack('fallback', 'music/fallback.mp3');
    }
    
    createSoundPool(name, path, poolSize, options = {}) {
        console.log(`Creating sound pool for ${name} with path ${path}`);
        
        // Check if pool already exists
        if (this.soundPools.has(name)) {
            console.log(`Sound pool ${name} already exists, skipping creation`);
            return;
        }
        
        // Prefix the path with a slash if it doesn't have one
        // This ensures we're loading from the root of the domain
        if (!path.startsWith('/') && !path.startsWith('http')) {
            path = '/' + path;
        }
        
        console.log(`Full sound path: ${window.location.origin}${path}`);
        
        const pool = [];
        for (let i = 0; i < poolSize; i++) {
            try {
                const sound = new THREE.Audio(this.listener);
                const loader = new THREE.AudioLoader();
                
                loader.load(
                    path, 
                    (buffer) => {
                        console.log(`Successfully loaded sound: ${name} (instance ${i + 1}/${poolSize})`);
                        sound.setBuffer(buffer);
                        sound.setVolume(this.sfxVolume * this.masterVolume);
                        if (options.pitch) {
                            sound.setPlaybackRate(options.pitch);
                        }
                        
                        // Test if the sound can actually be played
                        try {
                            // Create a temporary copy to test playback
                            const testSound = sound.clone();
                            testSound.setVolume(0); // Silent test
                            testSound.play();
                            testSound.stop();
                            console.log(`Sound ${name} playback test successful`);
                        } catch (playError) {
                            console.error(`Sound ${name} playback test failed:`, playError);
                        }
                    },
                    (progress) => {
                        const percent = (progress.loaded / progress.total * 100).toFixed(2);
                        console.log(`Loading sound ${name} (instance ${i + 1}/${poolSize}): ${percent}%`);
                    },
                    (error) => {
                        console.error(`Error loading sound ${name} from ${path} (instance ${i + 1}/${poolSize}):`, error);
                    }
                );
                
                pool.push(sound);
            } catch (error) {
                console.error(`Error creating sound instance for ${name}:`, error);
            }
        }
        
        if (pool.length > 0) {
            this.soundPools.set(name, pool);
            console.log(`Created sound pool for ${name} with ${pool.length} instances`);
        } else {
            console.error(`Failed to create any sound instances for ${name}`);
        }
    }
    
    loadMusicTrack(name, path) {
        const music = new THREE.Audio(this.listener);
        const loader = new THREE.AudioLoader();
        
        // Prefix the path with a slash if it doesn't have one
        // This ensures we're loading from the root of the domain
        if (!path.startsWith('/') && !path.startsWith('http')) {
            path = '/' + path;
        }
        
        console.log(`Loading music track: ${name} from path: ${window.location.origin}${path}`);
        
        loader.load(path, 
            (buffer) => {
                console.log(`Successfully loaded music track: ${name}`);
                music.setBuffer(buffer);
                music.setVolume(this.musicVolume * this.masterVolume);
                music.setLoop(true);
            },
            (progress) => {
                const percent = (progress.loaded / progress.total * 100).toFixed(2);
                console.log(`Loading music ${name}: ${percent}%`);
            },
            (error) => {
                console.error(`Error loading music ${name} from ${path}:`, error);
            }
        );
        
        this.musicTracks.set(name, music);
    }
    
    playSound(name, position = null) {
        console.log(`Attempting to play sound: ${name}`);
        
        // Debug info about audio context
        console.log(`Audio context state: ${this.listener.context.state}`);
        console.log(`Audio context sample rate: ${this.listener.context.sampleRate}`);
        
        // Check audio context state
        if (this.listener.context.state === 'suspended') {
            console.warn('Audio context is suspended, attempting to resume...');
            this.listener.context.resume().then(() => {
                console.log('Audio context resumed, retrying sound playback');
                this.playSound(name, position);
            }).catch(error => {
                console.error('Failed to resume audio context:', error);
            });
            return null;
        }
        
        const pool = this.soundPools.get(name);
        if (!pool) {
            console.warn(`Sound pool not found: ${name}`);
            console.log('Available sound pools:', Array.from(this.soundPools.keys()));
            return null;
        }
        
        // Find an available sound from the pool
        const sound = pool.find(s => !s.isPlaying);
        if (!sound) {
            console.warn(`No available sounds in pool: ${name} (all ${pool.length} instances are playing)`);
            return null;
        }
        
        // Extra debug info about the sound
        console.log(`Sound ${name} details:`, {
            hasBuffer: !!sound.buffer,
            volume: sound.getVolume(),
            isPlaying: sound.isPlaying,
            duration: sound.buffer ? sound.buffer.duration : 'N/A'
        });
        
        // Check if sound is ready to play
        if (!sound.buffer) {
            console.warn(`Sound ${name} not loaded yet (buffer not ready)`);
            
            // Let's try to reload this sound
            console.log(`Attempting to reload missing sound: ${name}`);
            const filePath = this.getSoundFilePath(name);
            if (filePath) {
                const loader = new THREE.AudioLoader();
                loader.load(
                    filePath,
                    (buffer) => {
                        console.log(`Reloaded sound: ${name}`);
                        sound.setBuffer(buffer);
                        sound.setVolume(this.sfxVolume * this.masterVolume);
                        // Try to play it after reload
                        try {
                            sound.play();
                            console.log(`Playing sound ${name} after reload`);
                        } catch (playError) {
                            console.error(`Failed to play ${name} after reload:`, playError);
                        }
                    },
                    null,
                    (error) => console.error(`Failed to reload sound ${name}:`, error)
                );
            }
            
            return null;
        }
        
        try {
            // If position is provided, make it positional
            if (position) {
                console.log(`Creating positional sound at (${position.x}, ${position.y}, ${position.z})`);
                const posSound = new THREE.PositionalAudio(this.listener);
                posSound.setBuffer(sound.buffer);
                posSound.setVolume(this.sfxVolume * this.masterVolume);
                posSound.setRefDistance(20);
                posSound.setRolloffFactor(1);
                posSound.position.copy(position);
                
                try {
                    posSound.play();
                    console.log(`Successfully started playing positional sound: ${name}`);
                    return posSound;
                } catch (error) {
                    console.error(`Error playing positional sound ${name}:`, error);
                    return null;
                }
            }
            
            // Set the volume before playing
            sound.setVolume(this.sfxVolume * this.masterVolume);
            
            // Force release any previous playback
            if (sound.source) {
                console.log(`Force stopping previous sound instance for ${name}`);
                sound.stop();
            }
            
            // Try playing with a delay to allow any release to complete
            setTimeout(() => {
                try {
                    sound.play();
                    console.log(`Successfully started playing non-positional sound: ${name} with delay`);
                } catch (delayedError) {
                    console.error(`Delayed play error for ${name}:`, delayedError);
                }
            }, 50);
            
            // Immediate play attempt
            sound.play();
            console.log(`Successfully started playing non-positional sound: ${name}`);
            return sound;
        } catch (error) {
            console.error(`Error playing sound ${name}:`, error);
            
            // Try to recover by creating a new sound instance
            try {
                console.log(`Creating recovery sound for ${name}`);
                const recoverSound = new THREE.Audio(this.listener);
                recoverSound.setBuffer(sound.buffer);
                recoverSound.setVolume(this.sfxVolume * this.masterVolume);
                recoverSound.play();
                console.log(`Recovery attempt for ${name} successful`);
                return recoverSound;
            } catch (recoverError) {
                console.error(`Recovery attempt failed for ${name}:`, recoverError);
                return null;
            }
        }
    }
    
    // Helper method to get the file path for a sound
    getSoundFilePath(name) {
        // This is a simple mapping based on the sound pools we initialized
        const soundMap = {
            'engine_idle': '/sounds/engine_idle.mp3',
            'engine_rev': '/sounds/engine_rev.mp3',
            'tire_screech': '/sounds/tire_screech.mp3',
            'suspension_bounce': '/sounds/suspension_bounce.mp3',
            'shoot': '/sounds/weapon_fire.mp3',
            'explosion': '/sounds/vehicle_explosion.mp3',
            'hit': '/sounds/projectile_hit.mp3',
            'turret_shoot': '/sounds/turret_rotate.mp3',
            'wall_hit': '/sounds/metal_impact.mp3',
            'vehicle_hit': '/sounds/vehicle_hit.mp3',
            'metal_impact': '/sounds/metal_impact.mp3',
            'damage_warning': '/sounds/damage_warning.mp3',
            'shield_hit': '/sounds/shield_hit.mp3',
            'powerup_pickup': '/sounds/powerup_pickup.mp3',
            'powerup_speed': '/sounds/powerup_speed.mp3',
            'powerup_shield': '/sounds/powerup_shield.mp3',
            'powerup_health': '/sounds/powerup_health.mp3',
            'powerup_damage': '/sounds/powerup_damage.mp3',
            'powerup_ammo': '/sounds/powerup_ammo.mp3',
            'menu_select': '/sounds/menu_select.mp3',
            'menu_confirm': '/sounds/menu_confirm.mp3',
            'menu_back': '/sounds/menu_back.mp3',
            'chat_message': '/sounds/chat_message.mp3'
        };
        
        return soundMap[name] || null;
    }
    
    playMusic(name) {
        // Stop current music if playing
        if (this.currentMusic && this.currentMusic.isPlaying) {
            this.currentMusic.stop();
        }
        
        const music = this.musicTracks.get(name);
        if (!music) {
            console.warn(`Music track not found: ${name}`);
            return;
        }
        
        music.play();
        this.currentMusic = music;
    }
    
    stopMusic() {
        if (this.currentMusic && this.currentMusic.isPlaying) {
            this.currentMusic.stop();
        }
    }
    
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        this.updateAllVolumes();
    }
    
    setSFXVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        this.updateAllVolumes();
    }
    
    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        this.updateAllVolumes();
    }
    
    updateAllVolumes() {
        // Update sound pools
        for (const pool of this.soundPools.values()) {
            for (const sound of pool) {
                sound.setVolume(this.sfxVolume * this.masterVolume);
            }
        }
        
        // Update music tracks
        for (const music of this.musicTracks.values()) {
            music.setVolume(this.musicVolume * this.masterVolume);
        }
    }
    
    dispose() {
        // Stop and dispose all sounds
        for (const pool of this.soundPools.values()) {
            for (const sound of pool) {
                if (sound.isPlaying) sound.stop();
                sound.disconnect();
            }
        }
        
        // Stop and dispose all music
        for (const music of this.musicTracks.values()) {
            if (music.isPlaying) music.stop();
            music.disconnect();
        }
        
        this.soundPools.clear();
        this.musicTracks.clear();
        if (this.camera && this.listener) {
            this.camera.remove(this.listener);
        }
    }
    
    updateListenerPosition() {
        if (!this.camera || !this.listener) return;
        
        // In Three.js, the AudioListener automatically updates its position
        // based on the parent object (camera), so we don't need to manually
        // update it. The camera.add(this.listener) call in the constructor
        // sets up this relationship.
        
        // We'll keep this method for compatibility with existing code,
        // but we don't need to do anything here.
    }
} 