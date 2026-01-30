import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import axios from 'axios'
import Player from './components/Player'
import SongList from './components/SongList'
import { FaGoogleDrive, FaSearch, FaTimes, FaHeart, FaRegHeart, FaLock, FaCog } from 'react-icons/fa'
import LockScreen from './components/LockScreen'
import SettingsModal from './components/SettingsModal'

// Environment variable for API URL (Production vs Dev)
const API_BASE = import.meta.env.VITE_API_URL || '';

function App() {
  // Constants
  const LOCK_TIME = 5 * 60 * 1000; // 5 minutes

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Check if we have a valid session
    const lastActive = localStorage.getItem('driveplayer_last_active');
    if (!lastActive) return false;

    const elapsed = Date.now() - parseInt(lastActive, 10);
    return elapsed < LOCK_TIME;
  });

  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentSong, setCurrentSong] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentFolderId, setCurrentFolderId] = useState(null)
  const [currentFolderName, setCurrentFolderName] = useState('Library'); // Default title
  const rootFolderId = useRef(null); // Track root folder ID to hide back button

  // Favorites State (Persisted in localStorage)
  const [likedSongs, setLikedSongs] = useState(() => {
    const saved = localStorage.getItem('driveplayer_favorites');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse favorites", e);
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('driveplayer_favorites', JSON.stringify(likedSongs));
  }, [likedSongs]);

  // Theme State
  const [themeColor, setThemeColor] = useState('29, 185, 84'); // Default Spotify Green

  useEffect(() => {
    // Apply theme to CSS variable
    document.documentElement.style.setProperty('--theme-color', themeColor);
  }, [themeColor]);

  // Extract Vibrant Color from Album Art
  useEffect(() => {
    if (!currentSong) {
      setThemeColor('29, 185, 84');
      return;
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = `${API_BASE}/api/thumbnail/${currentSong.id}`;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        // Resize to small manageable size
        canvas.width = 50;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 50, 50);

        const imageData = ctx.getImageData(0, 0, 50, 50).data;
        let maxSaturation = -1;
        let bestColor = '29, 185, 84';

        // Sample every 4th pixel for speed
        for (let i = 0; i < imageData.length; i += 16) {
          const r = imageData[i];
          const g = imageData[i + 1];
          const b = imageData[i + 2];

          // Calculate Saturation (HSL)
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const delta = max - min;
          const saturation = max === 0 ? 0 : delta / max;

          // Prefer bright, saturated colors. Ignore nearly black/white.
          if (saturation > maxSaturation && max > 50 && max < 240) {
            maxSaturation = saturation;
            bestColor = `${r}, ${g}, ${b}`;
          }
        }

        // Fallback to average if no vibrant color found
        if (maxSaturation < 0.1) {
          // ... (Keep existing simple average or just default)
        }

        setThemeColor(bestColor);
      } catch (e) {
        console.error("Theme Extraction Failed:", e);
        setThemeColor('29, 185, 84');
      }
    };

    img.onerror = () => {
      setThemeColor('29, 185, 84');
    };
  }, [currentSong]);

  const toggleLike = (song) => {
    if (!song) return;
    setLikedSongs(prev => {
      const exists = prev.find(s => s.id === song.id);
      if (exists) {
        return prev.filter(s => s.id !== song.id);
      } else {
        return [...prev, song];
      }
    });
  };

  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState(0); // 0: Off, 1: All, 2: One
  const [showSettings, setShowSettings] = useState(false);

  // Helper to update last active time
  const updateLastActive = useCallback(() => {
    localStorage.setItem('driveplayer_last_active', Date.now().toString());
  }, []);

  const handleUnlock = () => {
    setIsAuthenticated(true);
    updateLastActive();
  };

  const handleLock = useCallback(() => {
    setIsAuthenticated(false);
    localStorage.removeItem('driveplayer_last_active');
    setIsPlaying(false); // Stop music on lock
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl + L to Lock
      if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        handleLock();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleLock]);

  // Persistent Auto-lock Logic
  useEffect(() => {
    if (!isAuthenticated) return;

    let timeout;

    const checkInactivity = () => {
      const lastActive = parseInt(localStorage.getItem('driveplayer_last_active') || '0', 10);
      const now = Date.now();

      // If playing, we assume active, so we update the timestamp to now
      // This ensures that if the user closes the app while playing, the timestamp is fresh.
      if (isPlaying) {
        updateLastActive();
        timeout = setTimeout(checkInactivity, 10000); // Check again in 10s (act as heartbeat)
        return;
      }

      if (now - lastActive > LOCK_TIME) {
        handleLock();
      } else {
        // Schedule next check
        // Calculate remaining time, but cap it at e.g. 1 sec minimum to avoid hot loops
        const remaining = LOCK_TIME - (now - lastActive);
        // If remaining is large, we can wait that long. 
        // BUT users might close/reopen, so we rely on the init check for that.
        // Here we just want to lock LIVE if they sit idle.
        timeout = setTimeout(checkInactivity, Math.max(1000, remaining));
      }
    };

    // User Interaction Listener
    // We throttle writing to localStorage to avoid perf issues
    let lastThrottledUpdate = 0;
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastThrottledUpdate > 5000) { // Update max once every 5s
        updateLastActive();
        lastThrottledUpdate = now;

        // If we were waiting for a lock, we might want to restart the check logic?
        // Actually the check logic relies on localStorage, so updating it is enough.
        // But we should ensure the timeout is running.
        clearTimeout(timeout);
        timeout = setTimeout(checkInactivity, LOCK_TIME);
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, handleUserActivity));

    // Start loop
    checkInactivity();

    return () => {
      clearTimeout(timeout);
      events.forEach(event => window.removeEventListener(event, handleUserActivity));
    };
  }, [isAuthenticated, isPlaying, handleLock, updateLastActive]);

  // Sorting State
  const [sortOption, setSortOption] = useState('name'); // 'name', 'date', 'size'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc', 'desc'

  const searchTimeout = useRef(null);
  const fileCache = useRef({}); // Cache for folder contents

  // Sorting Logic
  const sortedFiles = useMemo(() => {
    // 1. Separate folders and files
    const folders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    let songs = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

    // 2. Sort Songs
    songs.sort((a, b) => {
      let valA, valB;

      switch (sortOption) {
        case 'date':
          valA = new Date(a.createdTime || 0).getTime();
          valB = new Date(b.createdTime || 0).getTime();
          break;
        case 'size':
          valA = parseInt(a.size || 0);
          valB = parseInt(b.size || 0);
          break;
        case 'name':
        default:
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    // 3. Return combined (Folders always first, sorted by name usually, but for now we keep folders as is or sort them too? 
    // Let's keep folders top, songs sorted)
    return [...folders, ...songs];
  }, [files, sortOption, sortDirection]);

  // --- Title Cleaning Logic (Moved from SongList for consistency) ---

  // Helper: Find common terms (likely Artists) to help parsing
  const getCommonArtistTerms = useMemo(() => {
    const songs = sortedFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
    const termCounts = {};
    const threshold = 2;

    songs.forEach(s => {
      const name = s.name.replace(/\.[^/.]+$/, "").replace(/^\d+[\.\-\s]+/, "");
      const parts = name.split(' - ').map(p => p.trim());
      parts.forEach(p => {
        if (p.length > 2 && !/^\d+$/.test(p)) {
          termCounts[p] = (termCounts[p] || 0) + 1;
        }
      });
    });

    const common = new Set();
    Object.entries(termCounts).forEach(([term, count]) => {
      if (count >= threshold) common.add(term.toLowerCase());
    });
    return common;
  }, [sortedFiles]);

  const cleanTitle = useCallback((fileName) => {
    let name = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
    name = name.replace(/^\d+[\.\-\s]+/, "");    // Remove initial numbering

    const parts = name.split(' - ');

    if (parts.length > 1) {
      const part1 = parts[0].trim();
      const part2 = parts.slice(1).join(' - ').trim();

      const p1Lower = part1.toLowerCase();
      const p2Lower = part2.toLowerCase();

      // Frequency Heuristic
      const p1IsCommon = getCommonArtistTerms.has(p1Lower);
      const p2IsCommon = getCommonArtistTerms.has(p2Lower);

      if (p1IsCommon && !p2IsCommon) return part2;
      if (p2IsCommon && !p1IsCommon) return part1;

      // Comma Heuristic
      const p1Commas = (part1.match(/,/g) || []).length;
      const p2Commas = (part2.match(/,/g) || []).length;
      if (p1Commas > 0 && p2Commas === 0) return part2;
      if (p2Commas > 0 && p1Commas === 0) return part1;

      // Feat Heuristic
      const featRegex = /\s(feat|ft|featuring)\.?\s/i;
      if (featRegex.test(part1) && !featRegex.test(part2)) return part2;
      if (featRegex.test(part2) && !featRegex.test(part1)) return part1;

      // Suffix Heuristic
      const suffixes = ['remix', 'mix', 'live', 'edit', 'version', 'ver', 'cover', 'official', 'video', 'audio', 'lyrics', 'remastered', 'instrumental'];
      if (suffixes.some(s => p2Lower.includes(s))) return name;

      // Default
      return name;
    }
    return name;
  }, [getCommonArtistTerms]);

  // Fetch files (songs + folders)
  const fetchFiles = async (folderId = null) => {
    const cacheKey = folderId || 'root';

    // 1. Check Cache
    if (fileCache.current[cacheKey]) {
      // console.log("Cache hit for", cacheKey);
      setFiles(fileCache.current[cacheKey]);
      setLoading(false);
      // We need to restore folder name logic here if cached, but cache structure only saves files currently.
      // To strictly follow "cache hit", we might miss name. 
      // Simplified: If cache hit, we might not have name stored. 
      // Fix: Let's skip cache hit optimization for Name update OR assume 'Library' if null, which is not ideal.
      // Better: Store object in cache { files, folderName }
      // For now, let's just re-fetch to get name or set default if root.
      // Actually, let's keep it simple: If cache hit, just use files. Name might lag. 
      // Let's NOT use cache for now to ensure name is correct, OR upgrade cache structure.
      // UPGRADING CACHE STRUCTURE ON THE FLY IS RISKY.
      // Let's just fetch from API to get the name for now, it's fast enough.
      // OR: manually set name if root/favorites.
    }

    // Special Case: Favorites
    if (folderId === 'favorites') {
      setFiles(likedSongs);
      setCurrentFolderName('Favorites');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const url = folderId
        ? `${API_BASE}/api/files?folderId=${folderId}`
        : `${API_BASE}/api/files`;

      const res = await axios.get(url);
      setFiles(res.data.files);
      setCurrentFolderName(res.data.folderName || 'Library');

      // 2. Update Cache
      fileCache.current[cacheKey] = res.data.files; // Still caching just files for now to avoid breaking other logic

      // Update current folder id if not set (initial load)
      if (!folderId && res.data.folderId) {
        if (!rootFolderId.current) {
          rootFolderId.current = res.data.folderId;
        }
        setCurrentFolderId(res.data.folderId);
        // Also cache under the actual ID for future reference
        fileCache.current[res.data.folderId] = res.data.files;
      }
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setLoading(false);
    }
  };

  // Search function
  const searchFiles = async (query) => {
    if (!query.trim()) {
      setIsSearching(false);
      fetchFiles(currentFolderId);
      return;
    }

    setLoading(true);
    setIsSearching(true);
    try {
      const res = await axios.get(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
      setFiles(res.data);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      searchFiles(q);
    }, 500);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    fetchFiles(currentFolderId);
  };

  useEffect(() => {
    // Check URL params on load
    const params = new URLSearchParams(window.location.search);
    const folderId = params.get('folder');
    if (folderId) {
      setCurrentFolderId(folderId);
      fetchFiles(folderId);
    } else {
      fetchFiles();
    }
  }, []);

  // Handle Browser Back Button (Android Gesture)
  useEffect(() => {
    const onPopState = (event) => {
      // If we seek/play media, that might trigger updates, but navigation is key here
      const state = event.state;
      if (state && state.folderId) {
        setCurrentFolderId(state.folderId);
        fetchFiles(state.folderId);
      } else {
        // Back to root
        setCurrentFolderId(null);
        fetchFiles(null);
        // Ensure files are reset to root if we were in favorites without a real ID
        if (!state) fetchFiles(null);
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleFolderClick = (folderId) => {
    if (isSearching) {
      setSearchQuery('');
      setIsSearching(false);
    }

    // Push state so Back button works
    window.history.pushState({ folderId }, '', `?folder=${folderId}`);

    // Internal update
    setCurrentFolderId(folderId);
    fetchFiles(folderId);
  };

  // Listen for song ended event to auto-play next
  useEffect(() => {
    const handleSongEnded = () => {
      handleNext(true); // Auto advance
    };
    window.addEventListener('audio-ended', handleSongEnded);
    return () => window.removeEventListener('audio-ended', handleSongEnded);
  }, [currentSong, isShuffle, repeatMode, sortedFiles]); // sortedFiles dependency? -> We will fix this by using a queue ref or state

  // --- Queue System ---
  const [queue, setQueue] = useState([]);

  // Handle Play (Single Song Click in Current View)
  const handlePlay = (song) => {
    if (currentSong?.id === song.id) {
      setIsPlaying(!isPlaying);
    } else {
      // Set Queue to current view's songs
      const currentSongs = sortedFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
      setQueue(currentSongs);
      setCurrentSong(song);
      setIsPlaying(true);
    }
  };

  // Handle Folder Play (Background Queue)
  const handleFolderPlay = async (folderId) => {
    // 1. Fetch files specifically for this folder
    // Note: We do NOT navigate (pushState/setCurrentFolderId)
    // We do NOT setFiles (so view stays same)

    try {
      const url = `${API_BASE}/api/files?folderId=${folderId}`;
      const res = await axios.get(url);

      const fetchedFiles = res.data.files;
      // Filter for songs
      const songList = fetchedFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

      if (songList.length > 0) {
        // 2. Set Queue & Start Shuffle Play
        setQueue(songList);
        setIsShuffle(true);

        const randomIndex = Math.floor(Math.random() * songList.length);
        setCurrentSong(songList[randomIndex]);
        setIsPlaying(true);
      } else {
        alert("No audio files found in this folder.");
      }
    } catch (error) {
      console.error("Error fetching folder for playback:", error);
    }
  };

  const handleBack = () => {
    if (isSearching) {
      clearSearch();
      return;
    }
    // Trigger browser back, which triggers 'popstate' listener above
    window.history.back();
  };


  const handleNext = (auto = false) => {
    if (!currentSong) return;

    // Use QUEUE if available, otherwise fallback to sortedFiles (legacy/safety)
    const activeList = queue.length > 0 ? queue : sortedFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

    if (activeList.length === 0) return;

    // Repeat One logic
    if (repeatMode === 2 && auto) {
      // Re-find current song to be safe
      const currentIndex = activeList.findIndex(s => s.id === currentSong.id);
      if (currentIndex !== -1) setCurrentSong(activeList[currentIndex]);
      setIsPlaying(true);
      return;
    }

    if (isShuffle) {
      let randomIndex = Math.floor(Math.random() * activeList.length);
      // Avoid repeating same song if possible
      if (activeList.length > 1 && activeList[randomIndex].id === currentSong.id) {
        randomIndex = (randomIndex + 1) % activeList.length;
      }
      setCurrentSong(activeList[randomIndex]);
      setIsPlaying(true);
      return;
    }

    // Normal Sequence
    const currentIndex = activeList.findIndex(s => s.id === currentSong.id);
    // If song not in queue (e.g. queue changed), start from 0
    const startIdx = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = (startIdx + 1) % activeList.length;

    // Stop at end if Repeat is Off
    if (nextIndex === 0 && repeatMode === 0 && auto) {
      setIsPlaying(false);
      return;
    }

    setCurrentSong(activeList[nextIndex]);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    if (!currentSong) return;
    const activeList = queue.length > 0 ? queue : sortedFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
    if (activeList.length === 0) return;

    if (isShuffle) {
      let randomIndex = Math.floor(Math.random() * activeList.length);
      setCurrentSong(activeList[randomIndex]);
      setIsPlaying(true);
      return;
    }

    const currentIndex = activeList.findIndex(s => s.id === currentSong.id);
    const startIdx = currentIndex === -1 ? 0 : currentIndex;
    const prevIndex = (startIdx - 1 + activeList.length) % activeList.length;
    setCurrentSong(activeList[prevIndex]);
    setIsPlaying(true);
  };

  const handleShufflePlay = () => {
    // Determine context: use current view
    const songList = sortedFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
    if (songList.length === 0) return;

    setQueue(songList);
    const randomIndex = Math.floor(Math.random() * songList.length);
    setCurrentSong(songList[randomIndex]);
    setIsPlaying(true);
    setIsShuffle(true);
  };

  const toggleRepeat = () => {
    setRepeatMode((prev) => (prev + 1) % 3);
  };

  const handleSortChange = (option) => {
    if (sortOption === option) {
      // Toggle direction
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortOption(option);
      setSortDirection('asc'); // Default to asc for new option
    }
  };

  const handleGoHome = () => {
    setSearchQuery('');
    setIsSearching(false);
    setCurrentFolderId(null);
    fetchFiles(null);
    window.history.pushState(null, '', '/');
  };

  // If not authenticated, render Lock Screen ONLY
  // Placed here to ensure all hooks run above
  // if (!isAuthenticated) {
  //   return <LockScreen onUnlock={handleUnlock} />;
  // }

  return (
    <div className="min-h-screen bg-darker text-white selection:bg-primary selection:text-black">
      {/* Header */}
      <header className="fixed top-0 w-full z-40 bg-black border-b border-white/5 h-16 flex items-center px-6 justify-between">
        <div
          onClick={handleGoHome}
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <FaGoogleDrive className="text-primary text-2xl" />
          <h1 className="text-xl font-bold tracking-tight hidden md:block">DrivePlayer</h1>
        </div>

        {/* Search Bar */}
        <div className="relative w-full max-w-md mx-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaSearch className="text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-10 py-2 border border-white/10 rounded-full leading-5 bg-white/5 text-gray-300 placeholder-gray-500 focus:outline-none focus:bg-white/10 focus:ring-1 focus:ring-primary sm:text-sm transition-colors"
            placeholder="Search songs..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
            >
              <FaTimes />
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Settings Button */}
          <button
            onClick={() => setShowSettings(true)}
            className="hidden md:flex items-center justify-center p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            title="Settings"
          >
            <FaCog className="text-sm" />
          </button>

          {/* Lock Button (Added) */}
          <button
            onClick={handleLock}
            className="flex items-center justify-center p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            title="Lock App"
          >
            <FaLock className="text-sm" />
          </button>

          <button
            onClick={() => {
              setSearchQuery('');
              setIsSearching(false);
              setCurrentFolderId('favorites');
              setFiles(likedSongs);
              window.history.pushState({ folderId: 'favorites' }, '', '?folder=favorites');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${currentFolderId === 'favorites' ? 'bg-primary text-black' : 'bg-white/5 hover:bg-white/10 text-white'}`}
          >
            <FaHeart className={currentFolderId === 'favorites' ? 'text-black' : 'text-primary'} />
            <span className="hidden sm:inline font-medium">Favorites</span>
          </button>
        </div>

      </header>

      {/* Main Content */}
      <main className="mt-16 h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar relative">

        <SongList
          title={isSearching ? `Search Results for "${searchQuery}"` : currentFolderName}
          files={sortedFiles}
          loading={loading}
          currentSong={currentSong}
          onPlay={handlePlay}
          onFolderClick={handleFolderClick}
          onFolderPlay={handleFolderPlay}
          onBack={handleBack}
          canGoBack={(!!currentFolderId && currentFolderId !== rootFolderId.current) || isSearching}
          onShufflePlay={handleShufflePlay}
          sortOption={sortOption}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          cleanTitle={cleanTitle}
        />
      </main>

      {/* Player */}
      <Player
        currentSong={currentSong}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        onNext={handleNext}
        onPrev={handlePrev}
        isShuffle={isShuffle}
        repeatMode={repeatMode}
        onShuffleToggle={() => setIsShuffle(!isShuffle)}
        onRepeatToggle={toggleRepeat}
        cleanTitle={cleanTitle}
        likedSongs={likedSongs}
        toggleLike={toggleLike}
        themeColor={themeColor}
      />

      {/* Modals */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* Lock Screen Overlay - Always rendered for animation */}
      <LockScreen isLocked={!isAuthenticated} onUnlock={handleUnlock} />
    </div>
  )
}

export default App
