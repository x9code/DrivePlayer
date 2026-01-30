import React, { useState } from 'react';
import { FaTimes, FaSave, FaCog } from 'react-icons/fa';

const SettingsModal = ({ onClose }) => {
    const [currentPin, setCurrentPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // 1. Verify Current PIN
        const storedPin = localStorage.getItem('driveplayer_pin');
        const envPin = import.meta.env.VITE_APP_PIN || '0000';
        const actualCurrentPin = storedPin || envPin;

        if (currentPin !== actualCurrentPin) {
            setError('Incorrect current PIN');
            return;
        }

        // 2. Validate New PIN
        if (newPin.length < 4) {
            setError('New PIN must be at least 4 digits');
            return;
        }

        if (newPin !== confirmPin) {
            setError('New PINs do not match');
            return;
        }

        // 3. Save
        try {
            localStorage.setItem('driveplayer_pin', newPin);
            setSuccess('PIN updated successfully!');
            setTimeout(() => {
                onClose();
            }, 1000);
        } catch (err) {
            setError('Failed to save PIN');
        }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
                >
                    <FaTimes />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center">
                        <FaCog className="text-primary text-lg" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Settings</h2>
                </div>

                <div className="space-y-6">
                    <div>
                        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Security</h3>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1">Current Password</label>
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    value={currentPin}
                                    onChange={(e) => setCurrentPin(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-primary focus:outline-none transition-colors"
                                    placeholder="Enter current PIN"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1">New Password</label>
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    value={newPin}
                                    onChange={(e) => setNewPin(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-primary focus:outline-none transition-colors"
                                    placeholder="Enter new PIN"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    value={confirmPin}
                                    onChange={(e) => setConfirmPin(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-primary focus:outline-none transition-colors"
                                    placeholder="Confirm new PIN"
                                />
                            </div>

                            {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
                            {success && <p className="text-green-500 text-sm font-medium">{success}</p>}

                            <button
                                type="submit"
                                className="mt-2 w-full bg-primary text-black font-bold py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                            >
                                <FaSave />
                                <span>Update Password</span>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
