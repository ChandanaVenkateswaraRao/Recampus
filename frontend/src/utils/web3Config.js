import { ethers } from 'ethers';

export const connectWallet = async () => {
  if (!window.ethereum) {
    alert("MetaMask is not installed. Please install it to use Crypto features.");
    return null;
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    // Request account access
    const accounts = await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    return { address: accounts[0], signer };
  } catch (err) {
    console.error("User rejected connection", err);
    return null;
  }
};

export const sendEthToSeller = async (sellerAddress, amountInINR) => {
  if (!window.ethereum) return;

  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // CONVERSION LOGIC: 1 INR approx 0.000004 ETH (Sepolia Testnet)
    // In production, fetch real rate from an API like CoinGecko
    const exchangeRate = 0.000004; 
    const amountInEth = (amountInINR * exchangeRate).toFixed(18); // Max precision

    // Create Transaction
    const tx = await signer.sendTransaction({
      to: sellerAddress,
      value: ethers.parseEther(amountInEth.toString())
    });

    // Wait for blockchain to confirm
    await tx.wait();
    
    return { success: true, hash: tx.hash };
  } catch (err) {
    console.error("Payment Failed:", err);
    return { success: false, error: err.message };
  }
};