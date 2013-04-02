using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.IO;
using System.Web.SessionState;
using RIAppDemo.BLL.DataServices;


namespace RIAppDemo.Controllers
{
    [SessionState(SessionStateBehavior.Disabled)]
    public class DownloadController : Controller
    {
        public ActionResult Index()
        {
            return new EmptyResult();
        }
   
        public ActionResult ThumbnailDownload(int id)
        {
            try
            {
                RIAppDemoService svc = new RIAppDemoService(this.User);
                using (svc)
                {
                    MemoryStream stream = new MemoryStream();
                    string fileName = svc.GetThumbnail(id, stream);
                    if (string.IsNullOrEmpty(fileName))
                        return new HttpStatusCodeResult(400);
                    stream.Position = 0;
                    var res = new FileStreamResult(stream, System.Net.Mime.MediaTypeNames.Image.Jpeg);
                    res.FileDownloadName = fileName;
                    return res;
                }
            }
            catch (Exception ex)
            {
                return new HttpStatusCodeResult(404);
            }
        }

        public ActionResult DownloadTemplate(string name)
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string path1 = Path.Combine(baseDir, "Templates");
            string path2 = Path.GetFullPath(Path.Combine(path1, string.Format("{0}.html", name)));
            if (!path2.StartsWith(path1))
                throw new Exception("template name is invalid");
            return new FilePathResult(path2, System.Net.Mime.MediaTypeNames.Text.Plain);
        }
    
    }
}
