if(typeof stickers === "undefined") stickers = {};

stickers.Sticker = function(attrs){
  var self = this;
  if(!attrs) attrs = {};
  self._id = ko.observable(attrs._id);
  self.__v = ko.observable(attrs.__v);
  self.lastModified = ko.observable(attrs.lastModified);
  self.status = ko.observable(attrs.status);
  self.title = ko.observable(attrs.title);
  self.body = ko.observable(attrs.body);
  self.bodyHtml = ko.computed(function(){    
    return marked(self.body() || "");
  });
  self.headerLabel = function(){
    return self._id() ? "Edit Sticker" : "New Sticker";
  };
  self.saveButtonLabel = function(){
    return self._id()? "Save" : "Create";
  }
  self.save = function(){
    var data = ko.toJS(self);
    delete data.bodyHtml;
    $.ajax({
            url: "/sticker",
            contentType: 'application/json; charset=utf-8',
            type: "POST",
            data: JSON.stringify(data),
            dataType: "json",
            success: function(result) {
               self._id(result._id); 
               self.__v(result.__v);
               self.lastModified(result.lastModified);
              }
            });

  };
  var statusEventsubscriber = null;
  self.registerStatusEvent = function(handler){
    if(statusEventsubscriber) statusEventsubscriber.dispose();
    statusEventsubscriber = self.status.subscribe(function(newStatus){
      handler(self);
    });
  };

  self.previewing = ko.observable(true);
  self.disablePreviewing = function(){ self.previewing(false)}; 
  self.enablePreviewing = function(){ self.previewing(true)}; 
};

stickers.Lane = function(title){
  var self = this;
  self.title = ko.observable(title);
  self.stickers = ko.observableArray([]);
  self.getSticker = function(id){
    return _.find(this.stickers(), function(sticker){
      return sticker._id() == id;
    });
  }
}

stickers.Wall = function(attrs){
  var self = this;
  var lastModified;
  var continuePull = true;
  if(!attrs) attrs = {};
  self.statuses = attrs.statuses || ['Pending', 'In BA', 'Ready for Dev', 'In Dev', 'Ready for QA', 'In QA', 'Ready for Sign off', 'Completed'];//Todo: read from wall settings.
  self.defaultStatus = self.statuses[0];//Todo: read from wall settings
  self.lanes = ko.observableArray(_.map(self.statuses, function(status){ return new stickers.Lane(status);}));
  self.editingSticker = ko.observable(null);
  self.viewingSticker = ko.observable(null);
  self.pullUpdate = function(){
    var url = "/stickers";
    if(lastModified) url += "?lastModified=" + lastModified;
    $.ajax({
        url: url,
        type: "GET",
        success: function(data){
          _.each(data, function(stickerData){
            freshLastModified(stickerData.lastModified);
            var sticker = getSticker(stickerData._id);
            if(sticker)
              self.update(sticker, stickerData);
            else
              self.add(new stickers.Sticker(stickerData));
        });
        }
    });
  };

  self.startPull = function(){
    self.pullUpdate();
    if(continuePull)
      setTimeout(self.startPull, 500);
  }

  self.setNewSticker = function(){
    self.editingSticker(new stickers.Sticker({status: self.defaultStatus}));
  };

  self.saveEditingSticker = function(){
    if(!self.editingSticker()._id())
      self.add(self.editingSticker());
    self.editingSticker().save();
  }

  self.changeStatus = function(id, status){
    var sticker = getSticker(id);
    sticker.status(status);
    sticker.save(); 
  }

  self.add = function(sticker){
     var lane = getLane(sticker.status());
     if(lane) lane.stickers.push(sticker);
     sticker.registerStatusEvent(moveToNewLane);
  }

  self.update = function(sticker, stickerData){
     if(sticker.__v() == stickerData.__v) return; //local has the same version data, do not update
     for(var prop in stickerData){       
       if(sticker[prop] !== undefined)
         sticker[prop](stickerData[prop]);       
     }
  }

  self.viewSticker = function(id){
    var sticker = getSticker(id);
    self.viewingSticker(sticker);
  }

  self.editSticker = function(id){
    var sticker = getSticker(id);
    self.editingSticker(sticker);
  }

  function getSticker(id){
    for(var laneIndex in self.lanes()){
      var sticker = self.lanes()[laneIndex].getSticker(id);
      if(sticker) return sticker;
    }
    return null;
  }

  function getLane(status){
    return _.find(self.lanes(), function(lane){
      return lane.title() == status;
    });
  }

  function getLaneBySticker(sticker){
    return _.find(self.lanes(), function(lane){
      return _.contains(lane.stickers(), sticker);
    });
  }

 
  function moveToNewLane(sticker){
     var originalLane = getLaneBySticker(sticker);
     if(originalLane) originalLane.stickers.remove(sticker);

    var newLane = getLane(sticker.status());
    if(newLane) newLane.stickers.push(sticker);
  }

  function freshLastModified(newDateString){
    if(!lastModified || new Date(newDateString) > new Date(lastModified))
      lastModified = newDateString;
  }

 };
