import * as THREE from 'three';

export class SoundManager {
    constructor(camera) {
        // Flag to use fallback HTML5 Audio if THREE.js audio fails
        this.useFallbackAudio = false;
        
        // Flag to prevent circular updates between SoundManager and MusicPlayer
        this.isUpdatingVolume = false;
        
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create Three.js audio listener
            this.listener = new THREE.AudioListener();
            
            // Store camera reference but don't attach listener immediately
            // This avoids issues during initialization
            if (camera) {
                this.camera = camera;
                console.log('Camera reference stored - will attach listener later');
                
                // Use a setTimeout to delay attaching the listener
                // This gives the camera time to initialize properly
                setTimeout(() => {
                    try {
                        if (this.camera && this.listener) {
                            // Enhanced camera initialization check
                            const isValidMatrix = this.camera.matrixWorld && 
                                                 this.camera.matrixWorld.elements && 
                                                 !isNaN(this.camera.matrixWorld.elements[0]);
                            
                            if (isValidMatrix) {
                                this.camera.add(this.listener);
                                console.log('Audio listener successfully attached to camera');
                            } else {
                                console.warn('Camera matrix not valid yet - falling back to HTML5 Audio. This is normal during initialization and is handled automatically.');
                                this.useFallbackAudio = true;
                            }
                        }
                    } catch (attachError) {
                        console.error('Error attaching listener to camera:', attachError);
                        this.useFallbackAudio = true;
                    }
                }, 500); // 500ms delay
            } else {
                console.warn('No camera provided to SoundManager');
                // Without a camera, we should use fallback audio
                this.useFallbackAudio = true;
            }
        } catch (error) {
            console.error('Error initializing THREE.js audio:', error);
            this.useFallbackAudio = true;
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
        this.isMuted = false;
        this.sfxMuted = false;
        
        // Diagnostic info
        console.log('Audio initialization:');
        if (this.useFallbackAudio) {
            console.log('  - Using HTML5 Audio fallback mode');
        } else if (this.listener && this.listener.context) {
            console.log('  - Context state:', this.listener.context.state);
            console.log('  - Sample rate:', this.listener.context.sampleRate);
            console.log('  - Output channels:', this.listener.context.destination.channelCount);
        }
        console.log('  - Browser audio support:', this.detectAudioSupport());
        console.log('  - Fallback mode active:', this.useFallbackAudio);
        
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
            
            // Check if listener and context exist first
            if (!this.listener || !this.listener.context) {
                console.log('No valid audio listener or context found - using fallback audio');
                this.useFallbackAudio = true;
                
                // Remove event listeners since we can't use the audio context
                document.removeEventListener('click', unlockAudio);
                document.removeEventListener('touchstart', unlockAudio);
                document.removeEventListener('touchend', unlockAudio);
                document.removeEventListener('keydown', unlockAudio);
                return;
            }
            
            try {
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
                    }).catch(err => {
                        console.error('Error resuming audio context:', err);
                        this.useFallbackAudio = true;
                    });
                }
            } catch (error) {
                console.error('Error during audio unlock:', error);
                this.useFallbackAudio = true;
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
        
        // Check if listener and context exist first
        if (!this.listener || !this.listener.context) {
            console.log('No valid audio listener or context for test sound - using fallback audio');
            this.useFallbackAudio = true;
            return this.playFallbackSound('menu_select');
        }
        
        try {
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
                try {
                    oscillator.stop();
                    console.log('Test sound completed');
                } catch (error) {
                    console.error('Error stopping test sound:', error);
                }
            }, 100);
        } catch (error) {
            console.error('Error playing test sound:', error);
            this.useFallbackAudio = true;
            this.playFallbackSound('menu_select');
        }
    }
    
    checkAudioContext() {
        // If we're already in fallback mode, no need to check
        if (this.useFallbackAudio) {
            console.log('Using HTML5 Audio fallback mode - skipping audio context check');
            return;
        }
        
        // If there's no valid listener or context, switch to fallback mode
        if (!this.listener || !this.listener.context) {
            console.warn('No valid audio listener or context found - switching to fallback mode');
            this.useFallbackAudio = true;
            return;
        }
        
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
                    // Switch to fallback mode if we can't resume
                    this.enableFallbackMode();
                });
                document.removeEventListener('click', resumeAudio);
                document.removeEventListener('keydown', resumeAudio);
                document.removeEventListener('touchstart', resumeAudio);
            };
            
            document.addEventListener('click', resumeAudio);
            document.addEventListener('keydown', resumeAudio);
            document.addEventListener('touchstart', resumeAudio);
            
            // Set a timeout - if audio context is still suspended after 5 seconds, switch to fallback
            setTimeout(() => {
                if (this.listener && this.listener.context && this.listener.context.state === 'suspended') {
                    console.warn('Audio context still suspended after timeout - switching to fallback mode');
                    this.enableFallbackMode();
                }
            }, 5000);
        } else {
            console.log('Audio context is ready:', this.listener.context.state);
        }
    }
    
    // Method to explicitly enable fallback mode
    enableFallbackMode() {
        console.log('Switching to HTML5 Audio fallback mode');
        this.useFallbackAudio = true;
        
        // Play a test sound to verify fallback works
        this.playFallbackSound('menu_select');
    }
    
    initializeSoundPools() {
        // Vehicle sounds
        this.createSoundPool('engine_idle', 'sounds/engine_idle.mp3', 1);
        this.createSoundPool('engine_rev', 'sounds/engine_rev.mp3', 1);
        this.createSoundPool('engine_deceleration', 'sounds/engine_deceleration.mp3', 1);
        this.createSoundPool('tire_screech', 'sounds/tire_screech.mp3', 3);
        this.createSoundPool('tire_dirt', 'sounds/tire_dirt.mp3', 2);
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
        
        // If we're in fallback mode, don't even try to create three.js audio
        if (this.useFallbackAudio) {
            console.log(`Using fallback audio - skipping THREE.js sound pool creation for ${name}`);
            
            // Still register the sound name so getSoundFilePath works correctly
            const placeholder = {
                path: path,
                name: name,
                isFallback: true
            };
            
            this.soundPools.set(name, [placeholder]);
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
                // Verify that the listener exists and is ready before creating sounds
                if (!this.listener) {
                    console.warn(`Cannot create sound pool for ${name} - listener not initialized`);
                    this.useFallbackAudio = true;
                    break;
                }
                
                // Create the sound with a try/catch and additional validation
                const sound = new THREE.Audio(this.listener);
                
                // Validate the created sound
                if (!sound || typeof sound.setBuffer !== 'function') {
                    console.warn(`Created invalid sound object for ${name}`);
                    continue;
                }
                
                // Mark this as a sound effect (not music)
                sound.isSFX = true;
                sound.baseVolume = 1.0;
                
                // Create loader with error handling
                let loader;
                try {
                    loader = new THREE.AudioLoader();
                } catch (loaderError) {
                    console.error(`Error creating AudioLoader for ${name}:`, loaderError);
                    continue;
                }
                
                loader.load(
                    path, 
                    (buffer) => {
                        // Additional validation on the buffer
                        if (!buffer || !buffer.duration) {
                            console.warn(`Invalid buffer loaded for sound: ${name}`);
                            return;
                        }
                        
                        console.log(`Successfully loaded sound: ${name} (instance ${i + 1}/${poolSize})`);
                        
                        try {
                            sound.setBuffer(buffer);
                            
                            // Apply correct volume based on current settings
                            const effectiveVolume = this.isMuted || this.sfxMuted ? 0 : this.sfxVolume * this.masterVolume;
                            sound.setVolume(effectiveVolume);
                            
                            if (options.pitch) {
                                sound.setPlaybackRate(options.pitch);
                            }
                            
                            // Log successful loading
                            console.log(`Sound ${name} loaded successfully with buffer size: ${buffer.length} bytes, duration: ${buffer.duration}s`);
                            
                            // Flag that this sound is ready to be played
                            sound.isReady = true;
                        } catch (bufferError) {
                            console.error(`Error setting buffer for sound ${name}:`, bufferError);
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
        // Skip normal loading if in fallback mode
        if (this.useFallbackAudio || !this.listener) {
            console.log(`Using fallback mode - registering music track path: ${name}`);
            
            // Register the music track info but don't try to load via THREE.js
            this.musicTracks.set(name, {
                path: path,
                name: name,
                isPlaying: false,
                isFallback: true,
                play: () => this.playFallbackMusic(name, path),
                stop: () => this.stopFallbackMusic(name),
                setVolume: () => {}
            });
            return;
        }
        
        // Normal THREE.js loading path
        try {
            const music = new THREE.Audio(this.listener);
            
            // Verify that the music object was created properly
            if (!music || typeof music.setBuffer !== 'function') {
                console.warn(`Failed to create valid Audio object for music: ${name}`);
                this.useFallbackAudio = true;
                return this.loadMusicTrack(name, path); // Retry with fallback
            }
            
            // Create loader with error handling
            let loader;
            try {
                loader = new THREE.AudioLoader();
            } catch (loaderError) {
                console.error(`Error creating AudioLoader for music ${name}:`, loaderError);
                this.useFallbackAudio = true;
                return this.loadMusicTrack(name, path); // Retry with fallback
            }
            
            // Prefix the path with a slash if it doesn't have one
            // This ensures we're loading from the root of the domain
            if (!path.startsWith('/') && !path.startsWith('http')) {
                path = '/' + path;
            }
            
            console.log(`Loading music track: ${name} from path: ${window.location.origin}${path}`);
            
            loader.load(path, 
                (buffer) => {
                    // Validate buffer
                    if (!buffer || !buffer.duration) {
                        console.warn(`Invalid buffer loaded for music: ${name}`);
                        return;
                    }
                    
                    try {
                        console.log(`Successfully loaded music track: ${name}`);
                        music.setBuffer(buffer);
                        music.setVolume(this.musicVolume * this.masterVolume);
                        music.setLoop(true);
                        
                        // If this music was supposed to be playing, start it now
                        if (music.shouldPlay) {
                            music.play();
                        }
                    } catch (bufferError) {
                        console.error(`Error setting buffer for music ${name}:`, bufferError);
                    }
                },
                (progress) => {
                    const percent = (progress.loaded / progress.total * 100).toFixed(2);
                    console.log(`Loading music ${name}: ${percent}%`);
                },
                (error) => {
                    console.error(`Error loading music ${name} from ${path}:`, error);
                    
                    // If loading fails, register as a fallback track
                    this.musicTracks.set(name, {
                        path: path,
                        name: name,
                        isPlaying: false,
                        isFallback: true,
                        play: () => this.playFallbackMusic(name, path),
                        stop: () => this.stopFallbackMusic(name),
                        setVolume: () => {}
                    });
                }
            );
            
            this.musicTracks.set(name, music);
        } catch (error) {
            console.error(`Error setting up music ${name}:`, error);
            
            // Register fallback version
            this.musicTracks.set(name, {
                path: path,
                name: name,
                isPlaying: false,
                isFallback: true,
                play: () => this.playFallbackMusic(name, path),
                stop: () => this.stopFallbackMusic(name),
                setVolume: () => {}
            });
        }
    }
    
    // Fallback methods for music playback
    playFallbackMusic(name, path) {
        console.log(`Playing fallback music: ${name}`);
        
        // Stop any existing fallback music
        this.stopFallbackMusic();
        
        // Create a new audio element for the fallback music
        if (!path.startsWith('/') && !path.startsWith('http')) {
            path = '/' + path;
        }
        
        try {
            const audio = new Audio(path);
            audio.loop = true;
            audio.volume = this.isMuted ? 0 : this.musicVolume * this.masterVolume;
            
            // Store reference to the current fallback audio
            this.fallbackAudio = audio;
            
            // Play with error handling
            const playPromise = audio.play();
            if (playPromise) {
                playPromise.catch(error => {
                    console.warn(`Error playing fallback music ${name}:`, error);
                });
            }
            
            // Update the track object
            const trackObj = this.musicTracks.get(name);
            if (trackObj) {
                trackObj.isPlaying = true;
                trackObj.audio = audio;
            }
            
            this.currentMusic = trackObj || { name, isPlaying: true, audio };
            
            return audio;
        } catch (error) {
            console.error(`Error creating fallback music for ${name}:`, error);
            return null;
        }
    }
    
    stopFallbackMusic() {
        // Stop any existing fallback music
        if (this.fallbackAudio) {
            try {
                this.fallbackAudio.pause();
                this.fallbackAudio.currentTime = 0;
            } catch (error) {
                console.warn('Error stopping fallback music:', error);
            }
            this.fallbackAudio = null;
        }
        
        // Update isPlaying status on current music
        if (this.currentMusic) {
            this.currentMusic.isPlaying = false;
        }
    }
    
    playSound(name, position = null) {
        console.log(`Attempting to play sound: ${name}`);
        console.log(`Current volume settings - Master: ${this.masterVolume}, SFX: ${this.sfxVolume}, Muted: ${this.isMuted}, SFXMuted: ${this.sfxMuted}`);
        
        // Emergency alternative: Use regular HTML5 Audio API as fallback
        if (this.useFallbackAudio) {
            return this.playFallbackSound(name);
        }
        
        // Debug info about audio context
        console.log(`Audio context state: ${this.listener.context.state}`);
        
        // Check audio context state
        if (this.listener.context.state === 'suspended') {
            console.warn('Audio context is suspended, attempting to resume...');
            this.listener.context.resume().then(() => {
                console.log('Audio context resumed, retrying sound playback');
                this.playSound(name, position);
            }).catch(error => {
                console.error('Failed to resume audio context:', error);
                // Switch to fallback audio if we can't resume
                this.useFallbackAudio = true;
                return this.playFallbackSound(name);
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
            return this.playFallbackSound(name); // Try fallback as last resort
        }
        
        // Check if sound is ready to play
        if (!sound.buffer) {
            console.warn(`Sound ${name} not loaded yet (buffer not ready)`);
            // Try fallback instead
            return this.playFallbackSound(name);
        }
        
        try {
            // Apply volume with sound-specific multiplier
            const volumeMultiplier = this.getSoundVolumeMultiplier(name);
            const effectiveVolume = this.isMuted || this.sfxMuted ? 0 : this.sfxVolume * this.masterVolume * volumeMultiplier;
            console.log(`Setting sound volume: name=${name}, multiplier=${volumeMultiplier}, effective=${effectiveVolume}`);
            sound.setVolume(effectiveVolume);
            
            // Only try to play if we have a valid buffer
            if (sound.buffer) {
                // If position is provided and Three.js positional audio is supported
                if (position && THREE.PositionalAudio) {
                    try {
                        const pos = new THREE.PositionalAudio(this.listener);
                        pos.setBuffer(sound.buffer);
                        pos.setVolume(effectiveVolume);
                        pos.setRefDistance(20);
                        pos.setRolloffFactor(1);
                        pos.position.copy(position);
                        pos.play();
                        return pos;
                    } catch (err) {
                        console.warn('Positional audio failed, falling back to regular audio');
                        // Continue to regular audio playback
                    }
                }
                
                // Regular audio playback
                sound.play();
                console.log(`Successfully started playing sound: ${name}`);
                return sound;
            } else {
                console.warn(`Sound buffer for ${name} is not valid`);
                return this.playFallbackSound(name);
            }
        } catch (error) {
            console.error(`Error playing sound ${name}:`, error);
            return this.playFallbackSound(name);
        }
    }
    
    // Fallback method using standard HTML5 Audio
    playFallbackSound(name) {
        try {
            console.log(`Attempting to play ${name} using HTML5 Audio fallback`);
            const path = this.getSoundFilePath(name);
            if (!path) {
                console.warn(`No path found for sound: ${name}`);
                return null;
            }
            
            // Create a new Audio element
            const audio = new Audio(path);
            
            // Apply volume with sound-specific multiplier
            const volumeMultiplier = this.getSoundVolumeMultiplier(name);
            const effectiveVolume = this.isMuted || this.sfxMuted ? 0 : this.sfxVolume * this.masterVolume * volumeMultiplier;
            audio.volume = effectiveVolume;
            
            // Set up onerror handler to catch loading errors
            audio.onerror = (e) => {
                console.error(`Error loading fallback sound ${name} from ${path}:`, 
                    e.target.error || 'Unknown error');
            };
            
            // Play the sound after a short delay to allow time for loading
            setTimeout(() => {
                try {
                    const playPromise = audio.play();
                    if (playPromise) {
                        playPromise.then(() => {
                            console.log(`Fallback audio playing: ${name}`);
                        }).catch(error => {
                            console.error(`Fallback audio failed: ${name}`, error);
                            
                            // Try one more time with a workaround for iOS/Safari
                            this.playEmergencyFallbackSound(name);
                        });
                    }
                } catch (playError) {
                    console.error(`Error playing fallback sound ${name}:`, playError);
                    this.playEmergencyFallbackSound(name);
                }
            }, 100);
            
            return audio;
        } catch (error) {
            console.error(`Failed to play fallback sound ${name}:`, error);
            return null;
        }
    }
    
    // Last resort for playing sounds
    playEmergencyFallbackSound(name) {
        console.log(`Attempting emergency fallback for sound: ${name}`);
        
        try {
            // Use the global SoundFX object if available
            if (window.SoundFX && typeof window.SoundFX.play === 'function') {
                window.SoundFX.play(name);
                return;
            }
            
            // Create silent dummy sound for user interaction
            const dummy = document.createElement('audio');
            dummy.controls = false;
            dummy.autoplay = false;
            dummy.style.position = 'absolute';
            dummy.style.left = '-1000px';
            dummy.style.top = '-1000px';
            document.body.appendChild(dummy);
            
            // Add click handler to play sound on user interaction
            dummy.addEventListener('click', () => {
                const audio = new Audio(this.getSoundFilePath(name));
                if (audio) {
                    audio.volume = 0.5;
                    audio.play().catch(e => console.warn('Still could not play sound:', e));
                }
                
                // Remove dummy element after use
                document.body.removeChild(dummy);
            });
            
            // Simulate click after a short delay
            setTimeout(() => {
                try {
                    dummy.click();
                } catch (e) {
                    console.warn('Could not simulate click:', e);
                }
            }, 100);
        } catch (error) {
            console.error(`Failed to play emergency fallback sound ${name}:`, error);
        }
    }
    
    // Helper method to get the file path for a sound
    getSoundFilePath(name) {
        // This is a simple mapping based on the sound pools we initialized
        const soundMap = {
            'engine_idle': '/sounds/engine_idle.mp3',
            'engine_rev': '/sounds/engine_rev.mp3',
            'engine_deceleration': '/sounds/engine_deceleration.mp3',
            'tire_screech': '/sounds/tire_screech.mp3',
            'tire_dirt': '/sounds/tire_dirt.mp3',
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
    
    // Get the appropriate volume multiplier for a given sound
    getSoundVolumeMultiplier(name) {
        // Reduce vehicle sounds by 10%
        const vehicleSounds = [
            'engine_rev', 
            'engine_deceleration', 
            'tire_screech', 
            'tire_dirt', 
            'suspension_bounce'
        ];
        
        // Reduce idle sound by an additional 10% (total 20% reduction)
        if (name === 'engine_idle') {
            return 0.8; // 20% reduction
        } else if (vehicleSounds.includes(name)) {
            return 0.9; // 10% reduction
        }
        
        // Default multiplier for other sounds
        return 1.0;
    }
    
    playMusic(name) {
        // Stop current music if playing
        if (this.currentMusic && this.currentMusic.isPlaying) {
            try {
                this.currentMusic.stop();
            } catch (error) {
                console.warn(`Error stopping current music:`, error);
                this.stopFallbackMusic(); // Try fallback stop method
            }
        }
        
        const music = this.musicTracks.get(name);
        if (!music) {
            console.warn(`Music track not found: ${name}`);
            return;
        }
        
        try {
            // Check if this is a fallback object
            if (music.isFallback) {
                // Call the play function we attached to the fallback object
                music.play();
            } else if (typeof music.play === 'function') {
                // Mark that this track should be playing 
                // (in case the buffer is still loading)
                music.shouldPlay = true;
                
                // Only try to play if buffer is loaded
                if (music.buffer) {
                    music.play();
                } else {
                    console.log(`Music ${name} buffer not yet loaded, will play when ready`);
                }
            } else {
                console.warn(`Music track ${name} is not playable`);
                return;
            }
            
            this.currentMusic = music;
        } catch (error) {
            console.error(`Error playing music ${name}:`, error);
            
            // Try fallback method if THREE.js fails
            this.playFallbackMusic(name, this.getSoundFilePath(name) || `/music/${name}.mp3`);
        }
    }
    
    stopMusic() {
        if (this.currentMusic && this.currentMusic.isPlaying) {
            this.currentMusic.stop();
        }
    }
    
    setMasterVolume(volume) {
        console.log(`Setting master volume to ${volume} (previous: ${this.masterVolume})`);
        this.masterVolume = Math.max(0, Math.min(1, volume));
        
        // Update all active sounds and pools
        this.updateAllVolumes();
        
        console.log(`Master volume set to ${this.masterVolume}`);
    }
    
    setMusicVolume(volume) {
        console.log(`Setting music volume to ${volume} (previous: ${this.musicVolume})`);
        this.musicVolume = Math.max(0, Math.min(1, volume));
        
        // Update music volume if playing
        this.updateAllVolumes();
        
        console.log(`Music volume set to ${this.musicVolume}`);
    }
    
    setSFXVolume(volume) {
        console.log(`Setting SFX volume to ${volume} (previous: ${this.sfxVolume})`);
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        
        // Update all sound effects volumes
        this.updateAllVolumes();
        
        console.log(`SFX volume set to ${this.sfxVolume}`);
    }
    
    setMuted(isMuted) {
        const wasMuted = this.isMuted;
        this.isMuted = isMuted;
        
        // Update all volumes
        this.updateAllVolumes();
        
        if (wasMuted !== isMuted) {
            console.log(`Sound ${isMuted ? 'muted' : 'unmuted'}`);
        }
    }
    
    setSFXMuted(isMuted) {
        const wasMuted = this.sfxMuted;
        this.sfxMuted = isMuted;
        
        // Update all volumes
        this.updateAllVolumes();
        
        if (wasMuted !== isMuted) {
            console.log(`SFX ${isMuted ? 'muted' : 'unmuted'}`);
        }
    }
    
    updateAllVolumes() {
        console.log(`Updating all volumes: Master=${this.masterVolume}, SFX=${this.sfxVolume}, Music=${this.musicVolume}, Muted=${this.isMuted}, SFXMuted=${this.sfxMuted}`);
        
        // Update active sounds
        const activeCount = this.activeSounds.size;
        console.log(`Updating ${activeCount} active sounds`);
        for (const [soundId, sound] of this.activeSounds.entries()) {
            console.log(`Updating active sound: ${soundId}, isSFX=${sound.isSFX || false}`);
            this.updateSoundVolume(sound);
        }
        
        // Also update the central music player if available
        if (window.musicPlayer && typeof window.musicPlayer.updateMusicVolume === 'function' && !this.isUpdatingVolume) {
            try {
                this.isUpdatingVolume = true;
                console.log('Updating music player volume');
                window.musicPlayer.updateMusicVolume();
            } finally {
                // Reset flag after a small delay to ensure any pending callbacks complete
                setTimeout(() => {
                    this.isUpdatingVolume = false;
                }, 0);
            }
        }
        
        // Update sound pools (SFX)
        const effectiveSfxVolume = this.isMuted || this.sfxMuted ? 0 : this.sfxVolume * this.masterVolume;
        console.log(`Effective SFX volume for pools: ${effectiveSfxVolume}`);
        
        let poolCount = 0;
        let soundCount = 0;
        for (const [poolName, pool] of this.soundPools.entries()) {
            poolCount++;
            console.log(`Updating pool: ${poolName} with ${pool.length} sounds`);
            for (const sound of pool) {
                soundCount++;
                if (sound.isPlaying) {
                    console.log(`- Sound in pool ${poolName} is playing, setting volume to ${effectiveSfxVolume}`);
                }
                sound.setVolume(effectiveSfxVolume);
            }
        }
        console.log(`Updated ${soundCount} sounds in ${poolCount} pools with volume ${effectiveSfxVolume}`);
        
        // Update music tracks
        const effectiveMusicVolume = this.isMuted ? 0 : this.musicVolume * this.masterVolume;
        console.log(`Effective music volume: ${effectiveMusicVolume}`);
        let musicCount = 0;
        for (const [trackName, music] of this.musicTracks.entries()) {
            musicCount++;
            if (music.isPlaying) {
                console.log(`- Music track ${trackName} is playing, setting volume to ${effectiveMusicVolume}`);
            }
            music.setVolume(effectiveMusicVolume);
        }
        console.log(`Updated ${musicCount} music tracks with volume ${effectiveMusicVolume}`);
    }
    
    updateSoundVolume(sound) {
        if (!sound || this.useFallbackAudio) return;
        
        // Calculate effective volume based on whether it's SFX or music
        let effectiveVolume = 0;
        
        if (this.isMuted) {
            effectiveVolume = 0;
        } else if (sound.isSFX) {
            // For SFX, apply master and sfx volumes
            if (this.sfxMuted) {
                effectiveVolume = 0;
            } else {
                effectiveVolume = this.masterVolume * this.sfxVolume * sound.baseVolume;
            }
        } else {
            // For music, apply master and music volumes
            effectiveVolume = this.masterVolume * this.musicVolume * sound.baseVolume;
        }
        
        // Update sound volume
        if (sound.audioNode && sound.gainNode) {
            sound.gainNode.gain.value = effectiveVolume;
        } else if (sound.audio) {
            sound.audio.volume = effectiveVolume;
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