import { Component, OnInit, ViewChild, ElementRef, Output, Input, EventEmitter } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UploadService } from '../upload.service';
import { Upload } from '../upload';
import { finalize } from 'rxjs/operators';
import utilInstance from '../../model/util';
import { ImageService } from '../../provider/image.service';

@Component({
  selector: 'upload-form',
  templateUrl: './upload-form.component.html',
  styleUrls: ['./upload-form.component.scss']
})
export class UploadFormComponent implements OnInit {
  @Input() warps: number;
  @Input() type: string;
  progress: number = 0;
  selectedFiles: FileList;
  uploading: boolean = false;
  searchQuery: string = '';

  patterns: File[] = [];
  colors: File[] = [];

  patternLibrary: FileList;
  colorLibrary: FileList;
  patternLibraryFiltered: FileList;
  colorLibraryFiltered: FileList;

  imageToShow: any;
  downloadid: string;
  @ViewChild('uploadImage') canvas: ElementRef;
  @Output() onData: any = new EventEmitter();

  
  constructor(
    private upSvc: UploadService,
    private httpClient: HttpClient,
    private imageService: ImageService
  ) {}

  detectFiles(event) {
    this.selectedFiles = event.target.files;
  }

  async uploadAda(upload: Upload, file: File) {
    await this.upSvc.pushUpload(upload).then((snapshot) => {
      return this.upSvc.getDownloadData(upload.name);
    }).then((url) => {  
      console.log("got download", url)
      this.httpClient.get(url).toPromise()
      .then((data) => {
        var obj = {
          name: file.name.split(".")[0],
          data: data,
          type: 'ada',
        }
        this.onData.emit(obj);
        this.uploading = false;
        this.selectedFiles = null;
        this.upSvc.deleteUpload(upload);
      });
    });
  }

  async uploadImage(upload: Upload, file: File) {
    await this.upSvc.pushUpload(upload)
      .then((snapshot) => {
        console.log('loading:', upload);
        return this.imageService.loadFiles([upload.name]);
      })
      .then((uploaded) => {
        const obj = this.imageService.getImageData(upload.name);
        console.log('loaded:', obj.data.colors);
        // Create a FormData object to send the image file to the API
        const formData = new FormData();
        formData.append('image', file);
        
        // Make the HTTP POST request to the Colormind API
        this.httpClient.post('http://colormind.io/api/', obj.data.colors)
          .toPromise()
          .then((response: any) => {
            const colorPalette = response.result;
            console.log('Colormind API response:', colorPalette);
            // Perform any additional actions with the color palette
          })
          .catch((error) => {
            console.error('Colormind API error:', error);
          });
  
        this.onData.emit(obj);
        this.uploading = false;
        this.selectedFiles = null;
      })
      .catch(console.error);
  }

  loadPatternLibrary() {
    const folderUrl = 'assets/library';
    const files = [
      { filename: 'pattern1.png', tags: ['anger', 'aggression', 'nervousness'], kind: 'pattern' },
      { filename: 'pattern2.png', tags: ['happy', 'color', 'vibrance'], kind: 'pattern' },
    ]
  
    const filePromises = files.map((file) => {
      const url = `${folderUrl}/${file.filename}`;
      return this.httpClient
        .get(url, { responseType: 'blob' })
        .toPromise()
        .then((blob) => {
          const fileObj = new File([blob], file.filename, { type: blob.type });
          fileObj['tags'] = file.tags; // Assign the tags property to the File object
          fileObj['kind'] = file.kind; // Assign the kind property to the File object
          return fileObj;
        })
        .catch((error) => {
          console.error(`Failed to fetch file ${file.filename}:`, error);
          return null;
        });
    });
  
    Promise.all(filePromises)
      .then((filesWithTags) => {
        // Separate the files into patterns and colors
        this.patterns = filesWithTags.filter((file) => file.kind === 'pattern');
        this.colors = filesWithTags.filter((file) => file.kind === 'color');
        console.log('patterns', this.patterns);
        console.log('colors', this.colors);
  
        // Convert back to FileList instances
        this.patternLibrary = this.convertToFileList(this.patterns);
        this.colorLibrary = this.convertToFileList(this.colors);
        console.log('patternLibrary', this.patternLibrary);
        console.log('colorLibrary', this.colorLibrary);
  
        // Filter the pattern library and color library based on the initial empty search query
        this.patternLibraryFiltered = this.getFilteredPatterns();
        this.colorLibraryFiltered = this.getFilteredColors();
        console.log('patternLibraryFiltered', this.patternLibraryFiltered);
        console.log('colorLibraryFiltered', this.colorLibraryFiltered);
      });
  }
  
  

  convertToFileList(files: File[]): FileList {
    const dataTransfer = new DataTransfer();
    for (const file of files) {
      dataTransfer.items.add(file);
    }
    return dataTransfer.files;
  }

  get filteredPatternLibrary(): File[] {
    if (this.searchQuery.trim() === '') {
      return Array.from(this.patternLibrary ? this.patternLibrary : []);
    } else {
      const query = this.searchQuery.toLowerCase();
      const searchWords = query.split(' ');
      return Array.from(this.patternLibrary).filter((pattern) =>
        pattern['tags'].some((tag) => {
          const lowerCaseTag = tag.toLowerCase();
          // console.log('lowerCaseTag', lowerCaseTag);
          // console.log(,'searchWords', searchWords);
          // console.log(searchWords.some((word) => lowerCaseTag.includes(word)))
          return searchWords.some((word) => lowerCaseTag === word);
        })
      );
    }
  }
  

  isTagMatch(tag: string): boolean {
    if (this.searchQuery.trim() === '') {
      return true;
    } else {
      const query = this.searchQuery.toLowerCase();
      const searchWords = query.split(' ');
      return searchWords.some((word) => tag.toLowerCase() === word);
    }
  }

  async uploadDocument(event: any) {
    const file = event.target.files[0];
    const reader = new FileReader();
    const image = new Image();

    reader.onload = (e) => {
      const contents = e.target.result;
      // Extract the searchQuery from the document contents and assign it to the searchQuery property
      // Example: Assuming the searchQuery is extracted from the document and assigned to extractedSearchQuery variable
      const extractedSearchQuery = 'I was very happy during my hike. It was so vibrant.';
      this.searchQuery = extractedSearchQuery;
      // Call the method to filter the pattern library based on the extracted searchQuery
      this.filterPatternLibrary();
    };

    reader.readAsText(file);
    console.log('file', file);
  }

  filterPatternLibrary() {
    // Filter the pattern library based on the search query
    this.patternLibraryFiltered = this.getFilteredPatterns();

    // Filter the color library based on the search query
    this.colorLibraryFiltered = this.getFilteredColors();
  }
  
  getFilteredPatterns(): FileList {
    if (this.searchQuery.trim() === '') {
      return this.patternLibrary; // Return the original pattern library
    } else {
      const filteredPatterns = Array.from(this.patternLibrary).filter((pattern) =>
        pattern['tags'].some((tag) => {
          const lowerCaseTag = tag.toLowerCase();
          return this.searchQuery.toLowerCase().split(' ').some((word) => lowerCaseTag.includes(word));
        })
      );
  
      return this.convertToFileList(filteredPatterns);
    }
  }
  
  getFilteredColors(): FileList {
    if (this.searchQuery.trim() === '') {
      return this.colorLibrary; // If no search query, return null for the color library
    } else {
      const filteredColors = Array.from(this.colorLibrary).filter((color) =>
        color['tags'].some((tag) => {
          const lowerCaseTag = tag.toLowerCase();
          return this.searchQuery.toLowerCase().split(' ').some((word) => lowerCaseTag.includes(word));
        })
      );
  
      return this.convertToFileList(filteredColors);
    }
  }
  
  getPatternImageUrl(pattern: File): string {
    return `assets/library/${pattern.name}`;
  }
  
  uploadSingle(pattern: File) {
    if (this.selectedFiles) {
      this.uploading = true;
      let file: File = this.selectedFiles.item(0);
      let fileType = file.name.split(".").pop();
      const upload = new Upload(file);
  
      switch (fileType) {
        case 'ada':
          this.uploadAda(upload, file);
          break;
  
        case 'jpg':
        case 'bmp':
        case 'png':
          this.uploadImage(upload, file);
          break;
  
        default:
          break;
      }
    } else {
      this.uploading = true;
  let fileType = pattern.name.split(".").pop();
  const upload = new Upload(pattern);

  switch (fileType) {
    case 'ada':
      this.uploadAda(upload, pattern);
      break;

    case 'jpg':
    case 'bmp':
    case 'png':
      this.uploadImage(upload, pattern);
      break;

    default:
      break;
  }
    }
  }

  ngOnInit() {
    this.loadPatternLibrary();
  }
}
