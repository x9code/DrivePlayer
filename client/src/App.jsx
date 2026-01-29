
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import axios from 'axios'
import Player from './components/Player'
import SongList from './components/SongList'
import { FaGoogleDrive, FaSearch, FaTimes, FaHeart, FaRegHeart } from 'react-icons/fa'

// Environment variable for API URL (Production vs Dev)
const API_BASE = import.meta.env.VITE_API_URL || '';

function App() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentSong, setCurrentSong] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentFolderId, setCurrentFolderId] = useState(null)

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

  // Sorting State
  const [sortOption, setSortOption] = useState('name'); // 'name', 'date', 'size'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc', 'desc'

  const searchTimeout = useRef(null);
  const fileCache = useRef({}); // Cache for folder contents

  // Sorting Logic
  const getSortedFiles = useCallback(() => {
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

  const sortedFiles = getSortedFiles();

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
      return;
    }

    // Special Case: Favorites
    if (folderId === 'favorites') {
      setFiles(likedSongs);
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

      // 2. Update Cache
      fileCache.current[cacheKey] = res.data.files;

      // Update current folder id if not set (initial load)
      if (!folderId && res.data.folderId) {
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

  const handleBack = () => {
    if (isSearching) {
      clearSearch();
      return;
    }
    // Trigger browser back, which triggers 'popstate' listener above
    window.history.back();
  };

  const handlePlay = (song) => {
    if (currentSong?.id === song.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentSong(song);
      setIsPlaying(true);
    }
  };

  const handleNext = (auto = false) => {
    if (!currentSong) return;
    const songList = sortedFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
    if (songList.length === 0) return;

    // Repeat One logic: Only if auto-advanced (song ended)
    if (repeatMode === 2 && auto) {
      const currentIndex = songList.findIndex(s => s.id === currentSong.id);
      setCurrentSong(songList[currentIndex]);
      setIsPlaying(true); // Ensure play continues
      return;
    }

    if (isShuffle) {
      // Simple random shuffle (can be optimized to avoid repeats)
      let randomIndex = Math.floor(Math.random() * songList.length);
      if (songList.length > 1 && songList[randomIndex].id === currentSong.id) {
        randomIndex = (randomIndex + 1) % songList.length;
      }
      setCurrentSong(songList[randomIndex]);
      setIsPlaying(true);
      return;
    }

    // Normal / Repeat All logic
    const currentIndex = songList.findIndex(s => s.id === currentSong.id);
    const nextIndex = (currentIndex + 1) % songList.length;

    // Check stop condition: Wrap around, Repeat is Off, and Auto-advance
    if (nextIndex === 0 && repeatMode === 0 && auto) {
      setIsPlaying(false);
      return;
    }

    setCurrentSong(songList[nextIndex]);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    if (!currentSong) return;
    const songList = sortedFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
    if (songList.length === 0) return;

    // In shuffle mode, prev could be random or history. Using logic relative to list for simplicity or repeat current.
    // If repeat one is on, standard behavior is prev song, not replay current (unless seeking behavior implemented).

    if (isShuffle) {
      let randomIndex = Math.floor(Math.random() * songList.length);
      setCurrentSong(songList[randomIndex]);
      setIsPlaying(true);
      return;
    }

    const currentIndex = songList.findIndex(s => s.id === currentSong.id);
    const prevIndex = (currentIndex - 1 + songList.length) % songList.length;
    setCurrentSong(songList[prevIndex]);
    setIsPlaying(true);
  };

  const handleShufflePlay = () => {
    const songList = sortedFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
    if (songList.length === 0) return;

    const randomIndex = Math.floor(Math.random() * songList.length);
    setCurrentSong(songList[randomIndex]);
    setIsPlaying(true);
    setIsShuffle(true); // Enable shuffle mode
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

  return (
    <div className="min-h-screen bg-darker text-white selection:bg-primary selection:text-black">
      {/* Header */}
      <header className="fixed top-0 w-full z-40 bg-black/40 backdrop-blur-md border-b border-white/5 h-16 flex items-center px-6 justify-between">
        <div className="flex items-center gap-3">
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
      <main className="mt-16 h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar">
        <div className="bg-gradient-to-b from-primary/20 via-black to-black h-80 absolute w-full top-0 left-0 -z-10 opacity-50" />
        <SongList
          files={sortedFiles}
          loading={loading}
          currentSong={currentSong}
          onPlay={handlePlay}
          onFolderClick={handleFolderClick}
          onBack={handleBack}
          canGoBack={!!currentFolderId || isSearching}
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
      />
    </div>
  )
}

export default App
