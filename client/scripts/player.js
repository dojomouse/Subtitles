/**
 * Subtitle Player Class abstracts video playback for
 * different formats, including embedded HTML 5, Youtube, Vimeo(?)
 * etc.,
 *
 * Vimeo doesn't even support subtitles yet, so I doubt I'll include it
 * just yet. 
 *
 */


(function(Subtitler, window){


  // Constructor
  // 
  // src = either a video URL, or Blob URL (if embedding locally)
  // type = either 'youtube' or 'html'
  var VideoElement = function(src, options){
    var options = options || {};

    this.type = options.type || 'html';
    this.target = options.target || '#player';
    this.isReady = false; 

    // If we're embedding a youtube video, use the 
    // following constructor.
    // 
    // NOTE: This actually embeds the youtube video. So if
    // we go to another page, we'll have to use this constructor
    // again. Embeds should be in a separate function.
    if (this.type === 'youtube') {
      // Async load the required script for youtube
      var tag = document.createElement('script');
      tag.src = "//www.youtube.com/iframe_api";
      var firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      // The async callback provided by YouTube
      var self = this; 
      window.onYouTubeIframeAPIReady = function(){
        // Build the iframe
        self.isYoutube = true;
        self.videoNode = new YT.Player(self.target, {
          width: '400',
          videoId: src,
          playerVars: {
            controls: 0
          }
        });
        self.bindReady(); 
      }
    }

    // If we're embedding an HTML video, use the 
    // following constructor. 
    // 
    // Will this work if we supply a regular HTML5 URL
    // instead of constructing the blob url?
    if (this.type === 'html') {
      this.isHTML = true; 
      var el = this.videoNode = document.createElement('video');
      el.setAttribute('id', 'video-display');
      el.src = src;
    }

    // XXX Vimeo embed code
    if (this.type === 'vimeo') {
      this.isVimeo = true; 
      // https://developer.vimeo.com/player/embedding
    }

  };

  // Functions
  _.extend(VideoElement.prototype, {

    // Events
    
    // Loop the video if need be. 
    // Will this be triggered during 'seeking' with vimeo
    // and youtube?
    onTimeUpdate: function(){

      if (Subtitler.draggingCursor)
        return;

      var currentTime = this.getCurrentTime()
        , end = Session.get('endTime')
        , duration = Session.get('loopDuration')
        , start = Session.get('startTime');

      Session.set('currentTime', currentTime);

      if (!end) {
        Session.set('endTime', currentTime + duration);
        Session.set('startTime', currentTime);
      } else if (Session.get('looping') 
          && Session.get('videoPlaying')
          && currentTime > end) {
        this.seekTo(start);
      }
      
    },

    onPlayback: function(){
      console.log('on playback called');
      Session.set('videoPlaying', true);
      if (this.isYoutube)
        this.youtubeTimeUpdate();
    },

    onPauseOrError: function(){
      console.log('pause or error');
      Session.set('videoPlaying', false);
      if (this.isYoutube && this.youtubeInterval)
        Meteor.clearInterval(this.youtubeInterval);
    },

    onReady: function(){
      this.isReady = true; 
      this.bindEvents(); 
    },

    // The youtube api (unfortunately) doesn't have a time update
    // event like the HTML 5 player does. But we can emulate
    // it. When the video is playing, set an interval that calls
    // onTimeUpdate every 300 ms or so. If the video is
    // paused, stopped, or ended, stop the interval. Typically the
    // timeupdate interval fires (i think) at different rates 
    // depending on system load. We'll just stick with a conservative(?) 250. 
    youtubeTimeUpdate: function(stop){
      var update = _.bind(this.onTimeUpdate, this);
      this.youtubeInterval && Meteor.clearInterval(this.youtubeInterval);
      this.youtubeInterval = Meteor.setInterval(update, 250);
    },

    // Bind our events
    bindEvents: function(){
      var vid = this.videoNode
        , self = this;

      // Youtube Events
      if (this.isYoutube) {
        vid.addEventListener('onStateChange', function(state){
          if (state.data === 1) self.onPlayback();
          if (state.data === 0 || state.data === 2) self.onPauseOrError();
        });
        vid.addEventListener('onError', _.bind(this.onPauseOrError, this));

      // HTML5 Events
      } else if (this.isHTML) {
        vid.addEventListener('playing', _.bind(this.onPlayback, this));
        vid.addEventListener('pause', _.bind(this.onPauseOrError, this));
        vid.addEventListener('error', _.bind(this.onPauseOrError, this));
        vid.addEventListener('timeupdate', _.bind(this.onTimeUpdate, this));
 
      // Vimeo Events     
      } else if (this.isVimeo) {
        vid.addEventListener('playProgress, seek', _.bind(this.onTimeUpdate, this));
        vid.addEventListener('play', _.bind(this.onPlayback, this));
        vid.addEventListener('pause', _.bind(this.onPauseOrError, this));
        vid.addEventListener('finish', _.bind(this.onPauseOrError, this));
      }
    },

    // Bind onReady events with unified onReady function
    bindReady: function(){
      var vid = this.videoNode;

      if (this.isYoutube)
        vid.addEventListener('onReady', _.bind(this.onReady, this));
      
      else if (this.isHTML)
        vid.addEventListener('loadedmetadata', _.bind(this.onReady, this));
      
      else if (this.isVimeo)
        vid.addEventListener('ready', _.bind(this.onReady, this));
    },

    // Playback Control / State
    getCurrentTime: function(){
      return this.isHTML
        ? this.videoNode.currentTime
        : this.videoNode.getCurrentTime(); 
    },

    pauseVideo: function(){
      this.isYoutube 
        ? this.videoNode.pauseVideo() 
        : this.videoNode.pause();  
    },

    playVideo: function(){
      this.isYoutube
        ? this.videoNode.playVideo()
        : this.videoNode.play(); 
    },

    getVideoDuration: function(){
      return this.isHTML
        ? this.videoNode.duration
        : this.videoNode.getDuration(); 
    },

    seekTo: function(number){
      console.log('player seeking');
      this.isHTML
        ? this.videoNode.currentTime = number
        : this.videoNode.seekTo(number); 
    },

    // Vimeo doesn't support it. Firefox doesn't support
    // html5 playback rate. 
    setPlaybackRate: function(rate){
      if (this.isYoutube)
        this.videoNode.setPlaybackRate(rate)
      else if (this.isHTML)
        this.videoNode.playbackRate = rate; 
    },

    setTarget: function(target){
      this.target = target; 
      return this;
    },

    embedVideo: function(target) {
      target && this.setTarget(target);
      $(this.target).html(this.videoNode);

      // XXX Only call this once video is onReady?
      this.bindReady(); 
      return this;
    },

    // Sync our video with our captions
    // XXX Do I even use this??
    syncCaptions: function(time, options){
      var end = Session.get('endTime')
        , start = Session.get('startTime')
        , options = options || {};

      options.silence = options.silent || false; 

      if (time > end || time < start) {
        var result = Subtitles.findOne({startTime: {$lte : time}, endTime: {$gte: time}})
        if (result) {
          if (options.silent)
            Session.set('silentFocus', true)
          document.getElementById(result._id).focus(); 
          Session.set('currentSub', result)
        }
      }
    }

  });

  // Expose this class to the world.
  Subtitler.VideoElement = VideoElement; 

})(Subtitler, window);