const MAX_FILE_SIZE = 8 * 1024 * 1024;

const fileInput = document.querySelector('#file-input');
const dropZone = document.querySelector('#drop-zone');
const fileChip = document.querySelector('#file-chip');
const fileThumb = document.querySelector('#file-thumb');
const fileName = document.querySelector('#file-name');
const fileSize = document.querySelector('#file-size');
const removeFileButton = document.querySelector('#remove-file');
const convertButton = document.querySelector('#convert-button');
const buttonLabel = document.querySelector('.button-label');
const errorMessage = document.querySelector('#error-message');
const emptyPreview = document.querySelector('#empty-preview');
const loadingPreview = document.querySelector('#loading-preview');
const loadingMode = document.querySelector('#loading-mode');
const resultPreview = document.querySelector('#result-preview');
const resultImage = document.querySelector('#result-image');
const resultActions = document.querySelector('#result-actions');
const downloadLink = document.querySelector('#download-link');
const previewMode = document.querySelector('#preview-mode');
const modeInputs = document.querySelectorAll('input[name="mode"]');

let selectedFile;
let sourceUrl;
let resultUrl;
let isConverting = false;

dropZone.addEventListener('keydown', (event) => {
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault();
		fileInput.click();
	}
});

fileInput.addEventListener('change', () => {
	const [file] = fileInput.files;
	if (file) selectFile(file);
});

for (const eventName of ['dragenter', 'dragover']) {
	dropZone.addEventListener(eventName, (event) => {
		event.preventDefault();
		dropZone.classList.add('is-dragging');
	});
}

for (const eventName of ['dragleave', 'drop']) {
	dropZone.addEventListener(eventName, (event) => {
		event.preventDefault();
		dropZone.classList.remove('is-dragging');
	});
}

dropZone.addEventListener('drop', (event) => {
	const [file] = event.dataTransfer.files;
	if (file) selectFile(file);
});

removeFileButton.addEventListener('click', clearFile);
convertButton.addEventListener('click', convertImage);

for (const input of modeInputs) {
	input.addEventListener('change', () => {
		previewMode.textContent = getPreviewLabel();
		buttonLabel.textContent = getButtonLabel();
		loadingMode.textContent = getMode().replace('-', '→');
		if (resultUrl) resetResult();
	});
}

function selectFile(file) {
	clearError();

	if (!file.type.startsWith('image/')) {
		showError(
			'That file does not look like an image. Try a PNG, JPG, WebP or GIF.',
		);
		return;
	}

	if (file.size > MAX_FILE_SIZE) {
		showError('That image is over 8 MB. Choose a smaller file and try again.');
		return;
	}

	selectedFile = file;
	if (sourceUrl) URL.revokeObjectURL(sourceUrl);
	sourceUrl = URL.createObjectURL(file);
	fileThumb.src = sourceUrl;
	fileName.textContent = file.name;
	fileSize.textContent = formatFileSize(file.size);
	dropZone.hidden = true;
	fileChip.hidden = false;
	convertButton.disabled = false;
	resetResult();
}

function clearFile() {
	selectedFile = undefined;
	fileInput.value = '';
	fileThumb.removeAttribute('src');
	dropZone.hidden = false;
	fileChip.hidden = true;
	convertButton.disabled = true;
	if (sourceUrl) URL.revokeObjectURL(sourceUrl);
	sourceUrl = undefined;
	resetResult();
	clearError();
}

async function convertImage() {
	if (!selectedFile || isConverting) return;

	isConverting = true;
	clearError();
	setLoading(true);

	try {
		const formData = new FormData();
		formData.append('image', selectedFile);
		formData.append('mode', getMode());

		const response = await fetch('/api/convert', {
			method: 'POST',
			body: formData,
		});

		if (!response.ok) {
			const data = await response.json().catch(() => null);
			throw new Error(
				data?.error || 'The conversion failed. Please try again.',
			);
		}

		const gif = await response.blob();
		if (resultUrl) URL.revokeObjectURL(resultUrl);
		resultUrl = URL.createObjectURL(gif);
		resultImage.src = resultUrl;
		downloadLink.href = resultUrl;
		downloadLink.download = makeDownloadName(selectedFile.name, getMode());
		showResult();
	} catch (error) {
		showError(
			error instanceof Error
				? error.message
				: 'Conversion failed. Please try again.',
		);
		showEmptyPreview();
	} finally {
		isConverting = false;
		setLoading(false);
	}
}

function setLoading(loading) {
	convertButton.disabled = loading;
	removeFileButton.disabled = loading;
	for (const input of modeInputs) input.disabled = loading;
	convertButton.classList.toggle('is-loading', loading);
	buttonLabel.textContent = loading ? 'Creating GIF…' : getButtonLabel();

	if (loading) {
		emptyPreview.hidden = true;
		resultPreview.hidden = true;
		resultActions.hidden = true;
		loadingPreview.hidden = false;
	}
}

function showResult() {
	emptyPreview.hidden = true;
	loadingPreview.hidden = true;
	resultPreview.hidden = false;
	resultActions.hidden = false;
}

function showEmptyPreview() {
	emptyPreview.hidden = false;
	loadingPreview.hidden = true;
	resultPreview.hidden = true;
	resultActions.hidden = true;
}

function resetResult() {
	if (resultUrl) URL.revokeObjectURL(resultUrl);
	resultUrl = undefined;
	resultImage.removeAttribute('src');
	downloadLink.removeAttribute('href');
	showEmptyPreview();
}

function getMode() {
	return document.querySelector('input[name="mode"]:checked').value;
}

function getButtonLabel() {
	return 'Create GIF';
}

function getPreviewLabel() {
	return getMode() === '67-55' ? '67 + 55 effects' : `${getMode()} effect`;
}

function formatFileSize(bytes) {
	if (bytes < 1024) return `${bytes} bytes`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function makeDownloadName(name, mode) {
	const baseName = name.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9-_]+/gi, '-');
	return `${baseName || 'image'}-${mode}ified.gif`;
}

function showError(message) {
	errorMessage.textContent = message;
	errorMessage.hidden = false;
}

function clearError() {
	errorMessage.hidden = true;
	errorMessage.textContent = '';
}

window.addEventListener('beforeunload', () => {
	if (sourceUrl) URL.revokeObjectURL(sourceUrl);
	if (resultUrl) URL.revokeObjectURL(resultUrl);
});
