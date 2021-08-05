import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { Bounds, Interlacement } from '../../../core/model/datatypes';
import { Draft } from '../../../core/model/draft';
import { Subscription, fromEvent } from 'rxjs';
import { Loom } from '../../../core/model/loom';
import { Render } from '../../../core/model/render';
import { Timeline } from '../../../core/model/timeline';
import { Pattern } from '../../../core/model/pattern';
import { ScrollDispatcher } from '@angular/cdk/scrolling';
import { DraftviewerComponent } from '../../../core/draftviewer/draftviewer.component';


interface DesignModes{
  value: string;
  viewValue: string;
  icon: string;
}


/**
 * this component initatites the draft viewer with custom options. 
 * a copy of the draft is passed to the window and passed back to the parent on close (or null if changes not saved) 
 */
@Component({
  selector: 'app-draftdetail',
  templateUrl: './draftdetail.component.html',
  styleUrls: ['./draftdetail.component.scss']
})
export class DraftdetailComponent implements OnInit {

 
  //the draft view shared by this and weaver
  @ViewChild('dv', {read: DraftviewerComponent, static: true}) dv: DraftviewerComponent;

  design_modes: DesignModes[]=[
  {value: 'toggle', viewValue: 'Toggle Heddle', icon: "fas fa-adjust"},
  {value: 'up', viewValue: 'Set Heddle Up', icon: "fas fa-square"},
  {value: 'down', viewValue: 'Set Heddle Down', icon: "far fa-square"}
];


/**
 * local flag for the view parameter
 */
  is_yarn_view = false;


  /**
   * local param for default height
   */
  modal_height:number;

  /**
   * a reference to the draft that we're modifying
   */
  draft:Draft;

    /**
   * The name of the current selected brush.
   * @property {string}
   */
  design_mode = {
      name:'toggle',
      id: -1
    }


  /**
   * The weave Loom object.
   * @property {Loom}
   */
   loom: Loom;

  /**
   * The weave Render object.
   * @property {Render}
   */
   render: Render;

    /**
   * The weave Timeline object.
   * @property {Timeline}
   */
  timeline: Timeline = new Timeline();

   /**
   * A collection of patterns to use in this space
   * @property {Timeline}
   */
    patterns: Array<Pattern>;

  /**
  The current selection, as boolean array 
  **/
  copy: Array<Array<boolean>>;

  scrollingSubscription: any;



  constructor(private dialogRef: MatDialogRef<DraftdetailComponent>,
             @Inject(MAT_DIALOG_DATA) private data: any, 
             private scroll: ScrollDispatcher) { 

              this.scrollingSubscription = this.scroll
              .scrolled()
              .subscribe((data: any) => {
                 this.onWindowScroll(data);
               });

               this.draft = data.draft;
      

               this.draft.computeYarnPaths();


               this.copy = [];

               this.loom = new Loom(this.draft, 8, 10);
               this.loom.recomputeLoom(this.draft);

               this.render = new Render(false, this.draft);
               this.render.updateVisible(this.draft);
               
               this.timeline = new Timeline();
    

               this.timeline.addHistoryState(this.draft);  
                            
               console.log("value on construct", this.dv);


               this.modal_height = (this.draft.wefts+20) * this.render.getCellDims('base').h;

  }

  updateSelection(event: any){
    console.log("selection detected");
  }

  private onWindowScroll(data: any) {
    this.dv.rescale();
  }



  ngOnInit() {


  }


  ngAfterViewInit(){

    this.dv.onNewDraftLoaded();
    this.dv.redraw({
      drawdown: true, 
      loom:true, 
      warp_systems: true, 
      weft_systems: true, 
      warp_materials: true,
      weft_materials:true
    });

    this.dv.rescale();

   
  }
  
  onNoClick(){
    this.onSave();
  }

  public onCancel(){
    this.scrollingSubscription.unsubscribe();
    this.dialogRef.close(null);
  }

  public onSave(){
    this.scrollingSubscription.unsubscribe();
    this.dialogRef.close(this.draft);
  }

  public toggleFrames(){


    //this.render.toggleViewFrames();

    if(this.render.view_frames){
      this.loom.recomputeLoom(this.draft);
    }

    this.dv.redraw({loom:true});  }

  /**
   * Updates the canvas based on the weave view.
   * @extends WeaveComponent
   * @param {Event} e - view change event from design component.
   * @returns {void}
   */
   public toggleView() {


    
    if(this.is_yarn_view){
      this.draft.computeYarnPaths();
      this.render.setCurrentView('visual');
    }else{
      this.render.setCurrentView('pattern');

    }

    this.dv.redraw({
      drawdown: true
    });
  }

}