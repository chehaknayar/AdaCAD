import { Component, OnInit, Output, EventEmitter, Inject } from '@angular/core';
import { OperationService } from '../../../core/provider/operation.service';
import {MatTooltipModule} from '@angular/material/tooltip';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import {FormControl} from '@angular/forms';
import {Observable} from 'rxjs';
import {map, startWith} from 'rxjs/operators';

@Component({
  selector: 'app-ops',
  templateUrl: './ops.component.html',
  styleUrls: ['./ops.component.scss']
})
export class OpsComponent implements OnInit {
  
  @Output() onOperationAdded:any = new EventEmitter();
  @Output() onImport:any = new EventEmitter();
  
  opnames:Array<string> = [];
  displaynames:Array<string> = [];
  myControl = new FormControl();
  myControl1 = new FormControl();
  filteredOptions: Observable<string[]>;
  taggedOptions: Observable<string[]>;
  
  constructor(public ops: OperationService, private dialog: MatDialog,
    private dialogRef: MatDialogRef<OpsComponent>,
             @Inject(MAT_DIALOG_DATA) public data: any) { }

  ngOnInit() {

    const allops = this.ops.ops.concat(this.ops.dynamic_ops);
    this.opnames = allops.map(el => el.name);
    this.displaynames = allops.map(el => el.displayname);
    //add tags to display names
    this.displaynames = this.displaynames.map((el, ndx) => {
      if(allops[ndx].tags){
        console.log("tags", allops[ndx].tags);
        return el + " (" + allops[ndx].tags.join(", ") + ")";
      }else{
        return el;
      }
    });

    this.filteredOptions = this.myControl.valueChanges.pipe(
      startWith(''),
      map(value => this._filter(value))
      
    );
    var matchedtag=[];
    this.taggedOptions = this.myControl.valueChanges.pipe(
      map(value => {
        const inputWords = value.toLowerCase().split(' ').map(word => word.replace(/[^\w\s]/g, '')); // Remove punctuation
        console.log("input words: ", inputWords)
        const matchedOptions = allops.filter(op => {
          if (op.tags) {
            const lowerCaseTags = op.tags.map(tag => tag.toLowerCase());
            return lowerCaseTags.some(tag => inputWords.some(word => tag.includes(word)));
          }
          return false;
        });
        return matchedOptions.map(op => {
          const matchedTags = op.tags ? op.tags.filter(tag => inputWords.some(word => tag.toLowerCase().includes(word))) : [];
          return op.name + (matchedTags.length > 0 ? ` (${matchedTags.join(', ')})` : '');
        });
      })
    );
  }

  private _filter(value: string): string[] {
    const filterValue = value.toLowerCase();
    return this.displaynames.filter(option => option.toLowerCase().includes(filterValue));
  }

  close() {
    this.dialogRef.close(null);
  }



  addOp(name: string){
      this.onOperationAdded.emit(name);  
  }

  addOpFromSearch(event: any){
    //need to convert display name toname here
    const ndx = this.displaynames.findIndex(el => el === event.option.value);
    if(ndx !== -1){
      this.onOperationAdded.emit(this.opnames[ndx]);
    }


  }




}
