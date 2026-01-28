import React from 'react';
import { FaPlay, FaFolder, FaArrowLeft } from 'react-icons/fa';

const SongList = ({ files, currentSong, onPlay, onFolderClick, loading, onBack, canGoBack, onShufflePlay }) => {

    // Separate content
    const folders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    const songs = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

    return (
        <div className="w-full max-w-7xl mx-auto pb-32 pt-6 px-6">

            {/* Header */}
            <header className="mb-8 sticky top-0 bg-darker/95 backdrop-blur-xl py-4 z-20 border-b border-white/5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    {canGoBack && (
                        <button onClick={onBack} className="p-2 bg-black/40 hover:bg-white/10 rounded-full transition-colors" title="Go Back">
                            <FaArrowLeft />
                        </button>
                    )}
                    <h2 className="text-2xl font-bold tracking-tight">Library</h2>
                </div>
                {songs.length > 0 && (
                    <button
                        onClick={onShufflePlay}
                        className="bg-green-500 hover:bg-green-400 text-black font-bold rounded-full p-3.5 transition-transform hover:scale-105 shadow-xl flex items-center justify-center"
                        title="Shuffle Play"
                    >
                        <FaPlay className="ml-1" size={18} />
                    </button>
                )}
            </header>

            {/* Folder Grid (Spotify Cards) */}
            {folders.length > 0 && (
                <div className="mb-10">
                    <h3 className="text-xl font-bold mb-5">Folders</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {folders.map(folder => {
                            // Deterministic cover selection based on name hash
                            const hash = folder.name.split("").reduce((a, b) => {
                                a = ((a << 5) - a) + b.charCodeAt(0);
                                return a & a;
                            }, 0);
                            const coverIndex = (Math.abs(hash) % 4) + 1; // 1 to 4

                            return (
                                <div
                                    key={folder.id}
                                    onClick={() => onFolderClick(folder.id)}
                                    className="group bg-[#181818] hover:bg-[#282828] transition-all duration-300 p-4 rounded-lg cursor-pointer flex flex-col gap-4 shadow-lg hover:shadow-2xl"
                                >
                                    <div className="relative w-full aspect-square rounded-md shadow-md flex items-center justify-center overflow-hidden group-hover:shadow-xl transition-shadow bg-zinc-800">
                                        <img
                                            src={`/covers/${coverIndex}.png`}
                                            alt={folder.name}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        />

                                        {/* Play Button on Hover */}
                                        <div className="absolute right-2 bottom-2 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 shadow-xl z-10">
                                            <div className="bg-green-500 rounded-full p-3 text-black shadow-lg hover:scale-105 transition-transform">
                                                <FaFolder size={20} className="ml-0.5" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1 min-h-[3rem]">
                                        <h4 className="font-bold text-white truncate w-full" title={folder.name}>{folder.name}</h4>
                                        <p className="text-sm text-zinc-400">Folder</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Song List */}
            {songs.length > 0 && (
                <div>
                    {/* List Header */}
                    <div className="grid grid-cols-[auto_1fr] gap-4 px-4 py-2 border-b border-white/10 text-zinc-400 text-sm font-medium mb-2 sticky top-20 bg-darker z-10">
                        <span className="w-8 text-center">#</span>
                        <span>Title</span>
                    </div>

                    <div className="flex flex-col">
                        {songs.map((file, index) => (
                            <div
                                key={file.id}
                                onClick={() => onPlay(file)}
                                className={`group grid grid-cols-[auto_1fr] items-center gap-4 p-3 rounded-md cursor-pointer transition-colors 
                                    ${currentSong?.id === file.id ? 'bg-white/10' : 'hover:bg-white/5'}
                                `}
                            >
                                <div className="text-zinc-400 w-8 text-center text-sm font-mono flex justify-center items-center">
                                    <span className="group-hover:hidden">{currentSong?.id === file.id ? <span className="text-green-500 animate-pulse">▶</span> : index + 1}</span>
                                    <FaPlay size={12} className="hidden group-hover:block text-white" />
                                </div>

                                <div className="flex items-center gap-4 min-w-0">
                                    {/* Thumbnail (Small) - Replaced with Icon per request */}
                                    <div className="w-10 h-10 bg-zinc-800 rounded flex-shrink-0 flex items-center justify-center text-zinc-500">
                                        <span className="text-xl">🎵</span>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h4 className={`truncate font-medium text-base ${currentSong?.id === file.id ? 'text-green-500' : 'text-white'}`}>
                                            {file.name.replace(/\.[^/.]+$/, "")}
                                        </h4>
                                        <p className="text-sm text-zinc-400 truncate">
                                            {(parseInt(file.size) / (1024 * 1024)).toFixed(1)} MB
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {loading && (
                <div className="text-center py-20 text-zinc-500 animate-pulse flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-zinc-600 border-t-green-500 rounded-full animate-spin"></div>
                    <p>Loading Library...</p>
                </div>
            )}

            {!loading && files.length === 0 && (
                <div className="text-center py-20 text-zinc-500">
                    <p className="text-xl">It's quiet here...</p>
                    <p className="text-sm">No songs or folders found.</p>
                </div>
            )}
        </div>
    );
};

export default SongList;
