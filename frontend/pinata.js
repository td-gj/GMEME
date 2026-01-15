// Pinata API Configuration
const PINATA_JWT = (import.meta.env.VITE_PINATA_JWT || "").trim();
if (!PINATA_JWT) {
    console.error('CRITICAL: VITE_PINATA_JWT is missing or empty!');
}

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
            const errorData = await response.json();
            console.error('Pinata Detailed Error:', errorData);
            throw new Error(`Pinata Error: ${errorData.error || response.statusText}`);
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
            const errorData = await response.json();
            console.error('Pinata Metadata Detailed Error:', errorData);
            throw new Error(`Pinata Metadata Error: ${errorData.error || response.statusText}`);
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
