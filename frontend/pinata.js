// Pinata API Configuration
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;

export const PINATA_GATEWAY = "https://ipfs.io/ipfs/";

// Upload file to Pinata
export async function uploadToPinata(file) {
    try {
        const formData = new FormData();
        formData.append('file', file);

        const metadata = JSON.stringify({
            name: file.name,
        });
        formData.append('pinataMetadata', metadata);

        const options = JSON.stringify({
            cidVersion: 0,
        });
        formData.append('pinataOptions', options);

        const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PINATA_JWT}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error('Failed to upload to Pinata');
        }

        const data = await response.json();
        return {
            success: true,
            ipfsHash: data.IpfsHash,
            url: `ipfs://${data.IpfsHash}`,
            gatewayUrl: `${PINATA_GATEWAY}${data.IpfsHash}`
        };
    } catch (error) {
        console.error('Pinata upload error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Upload JSON metadata to Pinata
export async function uploadMetadataToPinata(metadata) {
    try {
        const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PINATA_JWT}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        });

        if (!response.ok) {
            throw new Error('Failed to upload metadata to Pinata');
        }

        const data = await response.json();
        return {
            success: true,
            ipfsHash: data.IpfsHash,
            url: `ipfs://${data.IpfsHash}`,
            gatewayUrl: `${PINATA_GATEWAY}${data.IpfsHash}`
        };
    } catch (error) {
        console.error('Pinata metadata upload error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
