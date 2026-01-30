import React, { useState } from 'react';
import { FaTimes, FaSave, FaCog, FaMobileAlt, FaArrowLeft } from 'react-icons/fa';
import axios from 'axios';

// Environment variable for API URL (Production vs Dev)
const API_BASE = import.meta.env.VITE_API_URL || '';

const SettingsModal = ({ onClose }) => {
    const [currentPin, setCurrentPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [otp, setOtp] = useState('');

    // State: 'PWD' (enter passwords) -> 'OTP' (enter verification code)
    const [step, setStep] = useState('PWD');

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    // Step 1: Validate Password & Request OTP
    const handleRequestOtp = async (e) => {
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

        // 3. Request OTP from Server
        setLoading(true);
        try {
            await axios.post(`${API_BASE}/api/auth/otp/send`);
            setSuccess('OTP sent to phone ending in 5796');
            setStep('OTP');
        } catch (err) {
            setError('Failed to send OTP. Server error.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Verify OTP & Save
    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const res = await axios.post(`${API_BASE}/api/auth/otp/verify`, { otp });

            if (res.data.valid) {
                // Success! Save PIN.
                localStorage.setItem('driveplayer_pin', newPin);
                setSuccess('Password updated successfully!');
                setTimeout(() => {
                    onClose();
                }, 1500);
            } else {
                setError(res.data.message || 'Invalid OTP');
            }
        } catch (err) {
            setError('Verification failed');
            console.error(err);
        } finally {
            setLoading(false);
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
                        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">
                            {step === 'PWD' ? 'Change Password' : 'Verify Identity'}
                        </h3>

                        {step === 'PWD' ? (
                            <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">Current Password</label>
                                    <input
                                        type="password"
                                        inputMode="numeric"
                                        value={currentPin}
                                        onChange={(e) => setCurrentPin(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-primary focus:outline-none transition-colors"
                                        placeholder="Enter current PIN"
                                        required
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
                                        required
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
                                        required
                                    />
                                </div>

                                {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="mt-2 w-full bg-primary text-black font-bold py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? 'Sending OTP...' : (
                                        <>
                                            <FaMobileAlt />
                                            <span>Verify with SMS</span>
                                        </>
                                    )}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
                                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center mb-2">
                                    <p className="text-sm text-primary mb-1">OTP Sent Successfully!</p>
                                    <p className="text-xs text-zinc-400">Please check the server console or your phone ending in 5796</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">Enter Verification Code</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-3 text-white text-center text-xl tracking-widest focus:border-primary focus:outline-none transition-colors"
                                        placeholder="••••••"
                                        maxLength={6}
                                        required
                                        autoFocus
                                    />
                                </div>

                                {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}
                                {success && <p className="text-green-500 text-sm font-medium text-center">{success}</p>}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="mt-2 w-full bg-primary text-black font-bold py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? 'Verifying...' : (
                                        <>
                                            <FaSave />
                                            <span>Confirm Change</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setStep('PWD')}
                                    className="w-full py-2 text-zinc-400 hover:text-white text-sm transition-colors flex items-center justify-center gap-2"
                                >
                                    <FaArrowLeft className="text-xs" />
                                    <span>Back to Password</span>
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
