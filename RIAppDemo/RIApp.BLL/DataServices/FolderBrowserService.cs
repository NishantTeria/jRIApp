using System;
using System.Collections.Generic;
using System.Linq;
using System.Data.Linq;
using System.Text;
using System.Security.Principal;
using RIAPP.DataService;
using RIAPP.DataService.Utils;
using System.Collections;
using System.Data.Common;
using RIAppDemo.BLL.Utils;
using RIAppDemo.BLL.Models;
using System.IO;


namespace RIAppDemo.BLL.DataServices
{
    public class FolderBrowserService : BaseDomainService
    {
        private readonly string ROOT = AppDomain.CurrentDomain.BaseDirectory;
        //private readonly string ROOT =  System.Configuration.ConfigurationManager.AppSettings["FOLDER_BROWSER_PATH"];

        public FolderBrowserService(IPrincipal principal)
            : base(principal)
        { 
        }

        protected override Metadata GetMetadata()
        {
            return (Metadata)(new RIAppDemoMetadata().Resources["FolderBrowser"]);
        }

        [Authorize()]
        [Query]
        public QueryResult<FolderModel> ReadRoot(GetDataInfo getInfo, bool includeFiles)
        {
            return ReadChildren(getInfo, null, 0, "", includeFiles);
        }

        [Authorize()]
        [Query]
        public QueryResult<FolderModel> ReadChildren(GetDataInfo getInfo, string parentKey, int level, string path, bool includeFiles)
        {
            string fullpath = Path.GetFullPath(Path.Combine(ROOT,path));
            DirectoryInfo dinfo = new DirectoryInfo(fullpath);
            if (!includeFiles)
            {
                var dirs = dinfo.EnumerateDirectories();
                var res = dirs.Select(d => new FolderModel { Key = Guid.NewGuid().ToString(), ParentKey = parentKey, HasSubDirs = d.EnumerateDirectories().Any(), Level = level, Name = d.Name, IsFolder = true }).OrderBy(d=>d.Name);
                return new QueryResult<FolderModel>(res);
            }
            else
            {
                var fileSyst = dinfo.EnumerateFileSystemInfos();
                var res2 = fileSyst.Select(d => new FolderModel { Key = Guid.NewGuid().ToString(), ParentKey = parentKey, HasSubDirs = (d is DirectoryInfo) ? ((DirectoryInfo)d).EnumerateFileSystemInfos().Any() : false, Level = level, Name = d.Name, IsFolder = (d is DirectoryInfo) }).OrderByDescending(d=>d.IsFolder).ThenBy(d=>d.Name);
                return new QueryResult<FolderModel>(res2);
            }
        }

        public void DeleteFoldersDB(FolderModel dummy)
        {
            throw new NotImplementedException();
        }

        protected override void ExecuteChangeSet()
        {
            throw new NotImplementedException();
        }
    }
}
