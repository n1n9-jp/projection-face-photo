const ImageUtils = {
    detectIOS() {
        if (typeof navigator === 'undefined') return false;
        return /iP(hone|od|ad)/.test(navigator.userAgent);
    },

    getMaxImageDimension() {
        return this.detectIOS() ? 480 : 900;
    },

    scaleImageIfNeeded(image, maxImageDimension) {
        if (!image || !image.width || !image.height) {
            return Promise.resolve(image);
        }

        const maxSide = Math.max(image.width, image.height);
        if (maxSide <= maxImageDimension) {
            return Promise.resolve(image);
        }

        const ratio = maxImageDimension / maxSide;
        const targetWidth = Math.round(image.width * ratio);
        const targetHeight = Math.round(image.height * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

        return new Promise((resolve, reject) => {
            const resizedImage = new Image();
            resizedImage.onload = () => resolve(resizedImage);
            resizedImage.onerror = reject;
            resizedImage.src = canvas.toDataURL('image/png');
        });
    }
};
