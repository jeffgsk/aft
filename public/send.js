import * as cryptoJs from 'https://esm.run/crypto-js';

const rootPath = '/Users/jefftaylor/Downloads/quiet-quiet-js-7278254 2/examples/text/demoFiles/'; // Replace with your actual root path
const extensions = ['.txt', '.cs']; // Replace with the desired extensions
const searchApiUrl = "http://localhost:3002/search";
const fileContentApiUrl = "http://localhost:3002/file-content";

class TextTransmitter {
    constructor() {
        this.btn = null;
        this.h1 = null;
        this.textbox = null;
        this.warningbox = null;
        this.transmit = null;
        this.chunkSize = 50;  // Adjust chunk size as needed
        this.repeatCount = 8; // Number of times to repeat each fragment
        this.fragmentWaitTime = 2000; // Time to wait for fragments to arrive
    }

    init() {
        Quiet.init({
            profilesPrefix: "/",
            memoryInitializerPrefix: "/",
            libfecPrefix: "/"
        });
        document.addEventListener("DOMContentLoaded", this.onDOMLoad.bind(this));
    }

    onTransmitFinish() {
        this.textbox.focus();
        this.btn.disabled = false;
        var originalText = this.btn.innerText;
        this.btn.innerText = this.btn.getAttribute('data-quiet-sending-text');
        this.btn.setAttribute('data-quiet-sending-text', originalText);
    }

    timeout(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async onClick(e) {
        if (!this.transmit) {
            this.initializeTransmitter();
            await this.timeout(2000); // wait 2 seconds for the transmitter to initialize
        }
        e.target.removeEventListener(e.type, this.onClick.bind(this));
        e.target.disabled = true;
        var originalText = e.target.innerText;

        e.target.innerText = e.target.getAttribute('data-quiet-sending-text');
        e.target.setAttribute('data-quiet-sending-text', originalText);

        await this.processFiles();
    }

    async processFiles() {
        const files = await this.fetchFiles();
        const baseSavePath = '/project1/';
        for (const file of files) {
            let content = await this.fetchFileContent(rootPath, file.relativePath);
            content += `<||>${baseSavePath}${file.relativePath}`;

            let success = false;
            let missingFragments = [];

            while (!success) {
                if (missingFragments.length > 0) {
                    await this.resendMissingFragments(content, missingFragments);
                } else {
                    await this.sendTextContent(content);  // Use this correctly bound method
                }

                const response = await this.waitForReceiverResponse();
                success = response.success;
                missingFragments = response.missingFragments;

                if (!success) {
                    console.log('Resending missing fragments:', missingFragments);
                }
            }

            console.log('File received successfully. Proceeding to the next file.');

            const delay = 30000; // 30 seconds delay between files
            await this.timeout(delay);
        }
    }

    async sendTextContent(payload) {
        if (payload === "") {
            this.onTransmitFinish();
            return;
        }

        // Fragment and send the payload
        let fragmentCount = Math.ceil(payload.length / this.chunkSize);
        for (let i = 0; i < fragmentCount; i++) {
            let fragment = payload.substring(i * this.chunkSize, (i + 1) * this.chunkSize);
            const checksum = cryptoJs.default.MD5(fragment).toString();
            const fragmentToSend = `F>>${i}<~>${fragment}<~>${checksum}<<F`;

            console.log("Sending fragment:", fragmentToSend);

            // Transmit the fragment multiple times
            for (let j = 0; j < this.repeatCount; j++) {
                await this.transmit.transmit(Quiet.str2ab(fragmentToSend));
                await this.timeout(this.fragmentWaitTime); // Short delay between repeated transmissions
            }
        }

        // Compute checksum for the entire payload
        const totalChecksum = cryptoJs.default.MD5(payload).toString();
        const eotMessage = `E>>${totalChecksum}<<E`;

        console.log("Sending EOT message:", eotMessage);

        // Send the EOT message multiple times
        for (let k = 0; k < this.repeatCount; k++) {
            await this.transmit.transmit(Quiet.str2ab(eotMessage));
            await this.timeout(200); // Short delay between repeated transmissions
        }

        this.onTransmitFinish();
    }

    async waitForReceiverResponse() {
        let resolveResponse;
        const responsePromise = new Promise((resolve) => {
            resolveResponse = resolve;
        });

        function onReceiveResponse(payload) {
            const responseText = Quiet.ab2str(payload);
            if (responseText.startsWith("R>>") && responseText.endsWith("<<R")) {
                const response = JSON.parse(responseText.substring(3, responseText.length - 3));
                resolveResponse(response);
            }
        }

        Quiet.receiver({
            profile: 'audible',
            onReceive: onReceiveResponse,
            onReceiveFail: (num_fails) => {
                console.log("Failed to receive response", num_fails);
                resolveResponse({ success: false, missingFragments: [] });
            }
        });

        return await responsePromise;
    }

    async resendMissingFragments(content, missingFragments) {
        const fragmentCount = Math.ceil(content.length / this.chunkSize);
        for (let i = 0; i < fragmentCount; i++) {
            if (missingFragments.includes(i)) {
                let fragment = content.substring(i * this.chunkSize, (i + 1) * this.chunkSize);
                const checksum = cryptoJs.default.MD5(fragment).toString();
                const fragmentToSend = `F>>${i}<~>${fragment}<~>${checksum}<<F`;

                console.log("Resending fragment:", fragmentToSend);

                for (let j = 0; j < this.repeatCount; j++) {
                    await this.transmit.transmit(Quiet.str2ab(fragmentToSend));
                    await this.timeout(this.fragmentWaitTime);
                }
            }
        }

        // Resend the EOT message
        const totalChecksum = cryptoJs.default.MD5(content).toString();
        const eotMessage = `E>>${totalChecksum}<<E`;
        console.log("Resending EOT message:", eotMessage);
        for (let k = 0; k < this.repeatCount; k++) {
            await this.transmit.transmit(Quiet.str2ab(eotMessage));
            await this.timeout(200);
        }
    }

    async fetchFiles() {
        const requestBody = {
            searchPath: rootPath,
            extensions: extensions
        };

        try {
            const response = await fetch(searchApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            if (!response.ok) {
                throw new Error(`Error fetching files: ${response.statusText}`);
            }
            const files = await response.json();
            return files;
        } catch (error) {
            console.error(error);
            return [];
        }
    }

    async fetchFileContent(rootPath, relativeFilePath) {
        const requestBody = {
            rootPath: rootPath,
            relativeFilePath: relativeFilePath
        };

        try {
            const response = await fetch(fileContentApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            if (!response.ok) {
                throw new Error(`Error fetching file content: ${response.statusText}`);
            }
            const fileContent = await response.json();
            return fileContent.content;
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    initializeTransmitter() {
        var profilename = 'audible';
        this.transmit = Quiet.transmitter({ profile: profilename, onFinish: this.onTransmitFinish.bind(this) });
    }

    onQuietReady() {
        return;
    }

    onQuietFail(reason) {
        console.log("quiet failed to initialize: " + reason);
        this.warningbox.classList.remove("hidden");
        this.warningbox.textContent = "Sorry, it looks like there was a problem with this example (" + reason + ")";
    }

    onDOMLoad() {
        this.btn = document.querySelector('[data-quiet-send-button]');
        this.btn.addEventListener('click', this.onClick.bind(this), false);
        this.h1 = document.querySelector('h1');
        this.textbox = document.querySelector('[data-quiet-text-input]');
        this.warningbox = document.querySelector('[data-quiet-warning]');
        Quiet.addReadyCallback(this.onQuietReady.bind(this), this.onQuietFail.bind(this));
    }
}

const textTransmitter = new TextTransmitter();
textTransmitter.init();

export default TextTransmitter;