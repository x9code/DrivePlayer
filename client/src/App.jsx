
import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import Player from './components/Player'
import SongList from './components/SongList'
import { FaGoogleDrive, FaSearch, FaTimes } from 'react-icons/fa'

// Environment variable for API URL (Production vs Dev)
const API_BASE = import.meta.env.VITE_API_URL || '';

function App() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentSong, setCurrentSong] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentFolderId, setCurrentFolderId] = useState(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState(0); // 0: Off, 1: All, 2: One

  const searchTimeout = useRef(null);

  // Fetch files (songs + folders)
  const fetchFiles = async (folderId = null) => {
    setLoading(true);
    try {
      const url = folderId
        ? `${API_BASE}/api/files?folderId=${folderId}`
        : `${API_BASE}/api/files`;

      const res = await axios.get(url);
      setFiles(res.data.files);

      // Update current folder id if not set (initial load)
      if (!folderId && res.data.folderId) {
        setCurrentFolderId(res.data.folderId);
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

  const handleFolderClick = (folderId) => {
    if (isSearching) {
      // If searching, folder click should probably exit search and navigate? 
      // Or browse into folder? Let's assume browse into.
      setSearchQuery('');
      setIsSearching(false);
    }
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
      const songList = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
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
      const songList = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
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
      const songList = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
      if (songList.length === 0) return;

      const randomIndex = Math.floor(Math.random() * songList.length);
      setCurrentSong(songList[randomIndex]);
      setIsPlaying(true);
      setIsShuffle(true); // Enable shuffle mode
    };

    const toggleRepeat = () => {
      setRepeatMode((prev) => (prev + 1) % 3);
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

          <div className="w-8"></div> {/* Spacer */}
        </header>

        {/* Main Content */}
        <main className="pt-16 h-screen overflow-y-auto custom-scrollbar">
          <div className="bg-gradient-to-b from-primary/20 via-black to-black h-80 absolute w-full top-0 left-0 -z-10 opacity-50" />
          <SongList
            files={files}
            loading={loading}
            currentSong={currentSong}
            onPlay={handlePlay}
            onFolderClick={handleFolderClick}
            onBack={handleBack}
            canGoBack={!!currentFolderId || isSearching}
            onShufflePlay={handleShufflePlay}
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
        />
      </div>
    )
  }

  export default App
